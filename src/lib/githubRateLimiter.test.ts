import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import {
  parseRateLimitHeaders,
  classifyResponse,
  computeWaitMs,
  delay,
  tokenKey,
  isGitHubRateLimitError,
  GitHubRateLimiter,
  GitHubRateLimitError,
  GitHubSecondaryRateLimitError,
  GitHubRequestFailedError,
  RATE_LIMIT_TUNABLES,
} from './githubRateLimiter';

function headers(map: Record<string, string>): Headers {
  return new Headers(map);
}

describe('parseRateLimitHeaders', () => {
  it('parses all known headers and converts reset to epoch ms', () => {
    const state = parseRateLimitHeaders(
      headers({
        'x-ratelimit-limit': '5000',
        'x-ratelimit-remaining': '17',
        'x-ratelimit-used': '4983',
        'x-ratelimit-reset': '1000',
      })
    );
    expect(state).toEqual({
      limit: 5000,
      remaining: 17,
      used: 4983,
      resetAtMs: 1000 * 1000,
    });
  });

  it('returns undefineds for missing/garbage headers without throwing', () => {
    const state = parseRateLimitHeaders(headers({ 'x-ratelimit-remaining': 'abc' }));
    expect(state.remaining).toBeUndefined();
    expect(state.limit).toBeUndefined();
  });
});

describe('classifyResponse', () => {
  it('classifies a clean 200 as ok', () => {
    const r = classifyResponse(200, headers({ 'x-ratelimit-remaining': '100' }), JSON.stringify({ data: { ok: true } }));
    expect(r.kind).toBe('ok');
    expect(r.json?.data).toEqual({ ok: true });
  });

  it('classifies HTTP 200 with errors and remaining 0 as primary', () => {
    const r = classifyResponse(
      200,
      headers({ 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '2000' }),
      JSON.stringify({ errors: [{ message: 'API rate limit exceeded', type: 'RATE_LIMITED' }] })
    );
    expect(r.kind).toBe('primary');
    expect(r.error).toBeInstanceOf(GitHubRateLimitError);
    expect((r.error as GitHubRateLimitError).resetAtMs).toBe(2_000_000);
  });

  it('classifies 403 with rate limit text as primary', () => {
    const r = classifyResponse(403, headers({ 'x-ratelimit-remaining': '0' }), 'API rate limit exceeded for user');
    expect(r.kind).toBe('primary');
  });

  it('classifies secondary rate limit (403 + body text) as secondary', () => {
    const r = classifyResponse(
      403,
      headers({ 'retry-after': '30' }),
      'You have exceeded a secondary rate limit. Please retry your request again later.'
    );
    expect(r.kind).toBe('secondary');
    expect(r.error).toBeInstanceOf(GitHubSecondaryRateLimitError);
    expect((r.error as GitHubSecondaryRateLimitError).retryAfterMs).toBe(30_000);
  });

  it('classifies 429 as secondary', () => {
    const r = classifyResponse(429, headers({ 'retry-after': '5' }), 'slow down');
    expect(r.kind).toBe('secondary');
  });

  it('classifies ordinary errors with remaining budget as ok (not rate limit)', () => {
    const r = classifyResponse(
      200,
      headers({ 'x-ratelimit-remaining': '500' }),
      JSON.stringify({ errors: [{ message: 'Field not found' }], data: null })
    );
    expect(r.kind).toBe('ok');
  });

  it('classifies a generic 500 as failed', () => {
    const r = classifyResponse(500, headers({}), 'Internal Server Error');
    expect(r.kind).toBe('failed');
    expect(r.error).toBeInstanceOf(GitHubRequestFailedError);
    expect((r.error as GitHubRequestFailedError).status).toBe(500);
  });
});

describe('isGitHubRateLimitError', () => {
  it('is true for primary and secondary, false for generic', () => {
    expect(isGitHubRateLimitError(new GitHubRateLimitError('x'))).toBe(true);
    expect(isGitHubRateLimitError(new GitHubSecondaryRateLimitError('x'))).toBe(true);
    expect(isGitHubRateLimitError(new GitHubRequestFailedError('x', 500))).toBe(false);
    expect(isGitHubRateLimitError(new Error('x'))).toBe(false);
  });
});

describe('computeWaitMs', () => {
  it('honors retry-after for secondary limits', () => {
    const wait = computeWaitMs(new GitHubSecondaryRateLimitError('x', 30_000), Date.now());
    expect(wait).toBeGreaterThanOrEqual(30_000);
    expect(wait).toBeLessThan(30_000 + RATE_LIMIT_TUNABLES.maxJitterMs + 1);
  });

  it('waits until reset for primary limits', () => {
    const now = 1_000_000;
    const wait = computeWaitMs(new GitHubRateLimitError('x', now + 5_000), now);
    expect(wait).toBeGreaterThanOrEqual(5_000);
  });

  it('falls back to a minimum wait when no reset is known', () => {
    const wait = computeWaitMs(new GitHubRateLimitError('x'), Date.now());
    expect(wait).toBeGreaterThanOrEqual(RATE_LIMIT_TUNABLES.secondaryFallbackWaitMs);
  });
});

describe('delay', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('resolves after the given time', async () => {
    const p = delay(1000);
    vi.advanceTimersByTime(1000);
    await expect(p).resolves.toBeUndefined();
  });

  it('rejects immediately if signal already aborted', async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    await expect(delay(1000, ctrl.signal)).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('rejects when aborted mid-wait', async () => {
    const ctrl = new AbortController();
    const p = delay(5000, ctrl.signal);
    ctrl.abort();
    await expect(p).rejects.toMatchObject({ name: 'AbortError' });
  });
});

describe('tokenKey', () => {
  it('does not expose the full token', () => {
    const key = tokenKey('ghp_supersecretlongtoken1234');
    expect(key).not.toContain('supersecret');
    expect(key).toContain('1234');
  });
});

describe('GitHubRateLimiter scheduling', () => {
  let limiter: GitHubRateLimiter;
  beforeEach(() => {
    limiter = new GitHubRateLimiter();
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it('serializes and paces mutations for one token', async () => {
    const order: number[] = [];
    const make = (n: number) => () =>
      Promise.resolve().then(() => {
        order.push(n);
        return n;
      });

    const p1 = limiter.schedule('tokenA', 'mutation', make(1));
    const p2 = limiter.schedule('tokenA', 'mutation', make(2));

    await vi.runAllTimersAsync();
    await Promise.all([p1, p2]);
    expect(order).toEqual([1, 2]);
  });

  it('does not let one token block another', async () => {
    const slow = limiter.schedule('tokenA', 'mutation', () =>
      delay(10_000).then(() => 'a')
    );
    const fast = limiter.schedule('tokenB', 'mutation', () => Promise.resolve('b'));

    // tokenB has no pacing debt and should resolve without waiting on tokenA.
    await vi.advanceTimersByTimeAsync(0);
    await expect(fast).resolves.toBe('b');

    await vi.runAllTimersAsync();
    await expect(slow).resolves.toBe('a');
  });

  it('limits read concurrency but runs reads in parallel up to the cap', async () => {
    let active = 0;
    let maxActive = 0;
    const make = () => () =>
      delay(100).then(() => {
        active++;
        maxActive = Math.max(maxActive, active);
        active--;
        return true;
      });

    const reads = Array.from({ length: RATE_LIMIT_TUNABLES.readConcurrency + 3 }, () =>
      limiter.schedule('tokenA', 'query', make())
    );
    await vi.runAllTimersAsync();
    await Promise.all(reads);
    expect(maxActive).toBeLessThanOrEqual(RATE_LIMIT_TUNABLES.readConcurrency);
  });

  it('records and returns per-token state', () => {
    limiter.recordState('tokenA', { remaining: 42 });
    expect(limiter.getState('tokenA').remaining).toBe(42);
    expect(limiter.getState('tokenB').remaining).toBeUndefined();
  });
});
