import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { GitHubReadCache } from './githubReadCache';

describe('GitHubReadCache', () => {
  let cache: GitHubReadCache;
  beforeEach(() => {
    cache = new GitHubReadCache();
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it('serves a cached value within the TTL (one loader call)', async () => {
    const loader = vi.fn().mockResolvedValue('v1');
    const a = await cache.get('k', 1000, loader);
    const b = await cache.get('k', 1000, loader);
    expect(a).toBe('v1');
    expect(b).toBe('v1');
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('re-loads after the TTL expires', async () => {
    const loader = vi.fn().mockResolvedValueOnce('v1').mockResolvedValueOnce('v2');
    await cache.get('k', 1000, loader);
    vi.advanceTimersByTime(1001);
    const second = await cache.get('k', 1000, loader);
    expect(second).toBe('v2');
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('dedupes concurrent in-flight calls for the same key', async () => {
    let resolveLoad: (v: string) => void = () => {};
    const loader = vi.fn().mockImplementation(
      () => new Promise<string>((res) => { resolveLoad = res; })
    );
    const p1 = cache.get('k', 1000, loader);
    const p2 = cache.get('k', 1000, loader);
    resolveLoad('shared');
    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1).toBe('shared');
    expect(r2).toBe('shared');
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('keeps separate entries for separate keys (account scoping)', async () => {
    const loader = vi.fn().mockResolvedValueOnce('A').mockResolvedValueOnce('B');
    const a = await cache.get('userProjects:acctA', 1000, loader);
    const b = await cache.get('userProjects:acctB', 1000, loader);
    expect(a).toBe('A');
    expect(b).toBe('B');
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('does not cache a failed load', async () => {
    const loader = vi
      .fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce('ok');
    await expect(cache.get('k', 1000, loader)).rejects.toThrow('boom');
    const second = await cache.get('k', 1000, loader);
    expect(second).toBe('ok');
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('invalidate forces the next call to reload', async () => {
    const loader = vi.fn().mockResolvedValueOnce('v1').mockResolvedValueOnce('v2');
    await cache.get('k', 10_000, loader);
    cache.invalidate('k');
    const second = await cache.get('k', 10_000, loader);
    expect(second).toBe('v2');
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('invalidatePrefix drops all matching keys', async () => {
    const loader = vi.fn().mockResolvedValue('v');
    await cache.get('acct:1:projects', 10_000, loader);
    await cache.get('acct:1:repo', 10_000, loader);
    await cache.get('acct:2:projects', 10_000, loader);
    cache.invalidatePrefix('acct:1:');
    await cache.get('acct:1:projects', 10_000, loader); // reload
    await cache.get('acct:2:projects', 10_000, loader); // still cached
    // 3 initial + 1 reload = 4
    expect(loader).toHaveBeenCalledTimes(4);
  });

  it('ttlMs=0 still dedupes in-flight but does not cache the resolved value', async () => {
    const loader = vi.fn().mockResolvedValue('v');
    await cache.get('k', 0, loader);
    await cache.get('k', 0, loader);
    expect(loader).toHaveBeenCalledTimes(2);
  });
});
