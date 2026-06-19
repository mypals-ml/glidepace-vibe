import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { fetchGitHubGraphQL, getRepositoryId, batchUpdateProjectV2ItemFields, GitHubRateLimitError, GitHubRequestFailedError } from './githubService';
import { githubRateLimiter } from './githubRateLimiter';
import { githubReadCache } from './githubReadCache';
import { MOCK_TOKEN } from './githubMock';

const REAL_TOKEN = 'ghp_realtokenAAAA';
const QUERY = 'query Test { viewer { login } }';

function jsonResponse(
  body: unknown,
  init: { status?: number; headers?: Record<string, string> } = {}
): Response {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status: init.status ?? 200,
    headers: init.headers ?? { 'x-ratelimit-remaining': '4999' },
  });
}

describe('fetchGitHubGraphQL transport', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    githubRateLimiter.reset();
    githubReadCache.clear();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('bypasses the network entirely for the mock token', async () => {
    await fetchGitHubGraphQL(QUERY, {}, MOCK_TOKEN);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('bypasses the network for dummy project IDs', async () => {
    await fetchGitHubGraphQL(QUERY, { projectId: 'PVT_2' }, REAL_TOKEN);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns parsed data on a clean response', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: { viewer: { login: 'octocat' } } }));
    const result = await fetchGitHubGraphQL(QUERY, {}, REAL_TOKEN);
    expect(result.data).toEqual({ viewer: { login: 'octocat' } });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('records remaining budget per token from headers', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ data: {} }, { headers: { 'x-ratelimit-remaining': '123' } })
    );
    await fetchGitHubGraphQL(QUERY, {}, REAL_TOKEN);
    expect(githubRateLimiter.getState(REAL_TOKEN).remaining).toBe(123);
  });

  it('throws a typed GitHubRequestFailedError on a non-rate-limit 500', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse('boom', { status: 500, headers: {} }));
    await expect(fetchGitHubGraphQL(QUERY, {}, REAL_TOKEN)).rejects.toBeInstanceOf(
      GitHubRequestFailedError
    );
  });

  it('retries after a primary rate limit and then succeeds', async () => {
    vi.useFakeTimers();
    const now = Date.now();
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(
          { errors: [{ message: 'rate limit', type: 'RATE_LIMITED' }] },
          {
            status: 200,
            headers: {
              'x-ratelimit-remaining': '0',
              'x-ratelimit-reset': String(Math.floor((now + 2000) / 1000)),
            },
          }
        )
      )
      .mockResolvedValueOnce(jsonResponse({ data: { ok: true } }));

    const p = fetchGitHubGraphQL(QUERY, {}, REAL_TOKEN, { priority: 'background' });
    await vi.runAllTimersAsync();
    const result = await p;
    expect(result.data).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('gives up foreground requests with a typed error when the wait exceeds the budget', async () => {
    vi.useFakeTimers();
    const now = Date.now();
    // Reset far in the future -> wait exceeds the small foreground budget.
    fetchMock.mockResolvedValue(
      jsonResponse(
        { errors: [{ message: 'rate limit', type: 'RATE_LIMITED' }] },
        {
          status: 200,
          headers: {
            'x-ratelimit-remaining': '0',
            'x-ratelimit-reset': String(Math.floor((now + 3_600_000) / 1000)),
          },
        }
      )
    );

    const p = fetchGitHubGraphQL(QUERY, {}, REAL_TOKEN, { priority: 'foreground', maxWaitMs: 1000 });
    const assertion = expect(p).rejects.toBeInstanceOf(GitHubRateLimitError);
    await vi.runAllTimersAsync();
    await assertion;
  });

  it('dedupes identical in-flight reads sharing a dedupeKey', async () => {
    let resolveFetch: (r: Response) => void = () => {};
    fetchMock.mockImplementation(
      () => new Promise<Response>((res) => { resolveFetch = res; })
    );

    const p1 = fetchGitHubGraphQL(QUERY, {}, REAL_TOKEN, { dedupeKey: 'viewer' });
    const p2 = fetchGitHubGraphQL(QUERY, {}, REAL_TOKEN, { dedupeKey: 'viewer' });
    resolveFetch(jsonResponse({ data: { viewer: { login: 'octocat' } } }));

    const [r1, r2] = await Promise.all([p1, p2]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(r1).toBe(r2);
  });

  it('keeps per-token isolation: account A exhaustion does not affect account B', async () => {
    fetchMock.mockImplementation((_url: string, init: RequestInit) => {
      const auth = (init.headers as Record<string, string>).Authorization;
      if (auth.includes('TokenB')) {
        return Promise.resolve(jsonResponse({ data: { who: 'B' } }));
      }
      return Promise.resolve(jsonResponse({ data: { who: 'A' } }));
    });

    const a = await fetchGitHubGraphQL(QUERY, {}, 'ghp_TokenA1111');
    const b = await fetchGitHubGraphQL(QUERY, {}, 'ghp_TokenB2222');
    expect(a.data).toEqual({ who: 'A' });
    expect(b.data).toEqual({ who: 'B' });
  });
});

describe('getRepositoryId caching (Phase 3)', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    githubRateLimiter.reset();
    githubReadCache.clear();
    // Fresh Response per call — a Response body can only be read once.
    fetchMock = vi.fn(() => Promise.resolve(jsonResponse({ data: { repository: { id: 'REPO_1' } } })));
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('queries once then serves the cached repo id', async () => {
    const first = await getRepositoryId('octo', 'repo', REAL_TOKEN);
    const second = await getRepositoryId('octo', 'repo', REAL_TOKEN);
    expect(first).toBe('REPO_1');
    expect(second).toBe('REPO_1');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('keys the cache by owner/name (different repo re-queries)', async () => {
    await getRepositoryId('octo', 'repoA', REAL_TOKEN);
    await getRepositoryId('octo', 'repoB', REAL_TOKEN);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('batchUpdateProjectV2ItemFields (Phase 5)', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    githubRateLimiter.reset();
    githubReadCache.clear();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  function lastBody(): { query: string; variables: Record<string, unknown> } {
    const call = fetchMock.mock.calls.at(-1)!;
    return JSON.parse((call[1] as RequestInit).body as string);
  }

  it('sends one aliased request for multiple field writes', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ data: { u0: { projectV2Item: { id: 'I' } }, u1: { projectV2Item: { id: 'I' } } } })
    );
    const ok = await batchUpdateProjectV2ItemFields(
      'PROJ',
      'ITEM',
      [
        { kind: 'set', fieldId: 'F_START', value: { date: '2026-06-01' } },
        { kind: 'set', fieldId: 'F_EST', value: { number: 3 } },
      ],
      REAL_TOKEN
    );
    expect(ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = lastBody();
    expect(body.query).toContain('u0: updateProjectV2ItemFieldValue');
    expect(body.query).toContain('u1: updateProjectV2ItemFieldValue');
    expect(body.variables.fieldId0).toBe('F_START');
    expect(body.variables.fieldId1).toBe('F_EST');
    expect(body.variables.value1).toEqual({ number: 3 });
  });

  it('supports clear alongside set in one request', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ data: { c0: { projectV2Item: { id: 'I' } }, u1: { projectV2Item: { id: 'I' } } } })
    );
    const ok = await batchUpdateProjectV2ItemFields(
      'PROJ',
      'ITEM',
      [
        { kind: 'clear', fieldId: 'F_START' },
        { kind: 'set', fieldId: 'F_TARGET', value: { date: '2026-06-10' } },
      ],
      REAL_TOKEN
    );
    expect(ok).toBe(true);
    const body = lastBody();
    expect(body.query).toContain('c0: clearProjectV2ItemFieldValue');
    expect(body.query).toContain('u1: updateProjectV2ItemFieldValue');
  });

  it('falls back to a single request for one change', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: { updateProjectV2ItemFieldValue: { projectV2Item: { id: 'I' } } } }));
    await batchUpdateProjectV2ItemFields('PROJ', 'ITEM', [{ kind: 'set', fieldId: 'F', value: { number: 1 } }], REAL_TOKEN);
    const body = lastBody();
    expect(body.query).not.toContain('u0:');
  });

  it('returns false if the batch reports errors', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ errors: [{ message: 'bad field' }] }));
    const ok = await batchUpdateProjectV2ItemFields(
      'PROJ',
      'ITEM',
      [
        { kind: 'set', fieldId: 'F1', value: { number: 1 } },
        { kind: 'set', fieldId: 'F2', value: { number: 2 } },
      ],
      REAL_TOKEN
    );
    expect(ok).toBe(false);
  });

  it('no-ops (returns true, no request) for an empty change list', async () => {
    const ok = await batchUpdateProjectV2ItemFields('PROJ', 'ITEM', [], REAL_TOKEN);
    expect(ok).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
