/**
 * Small TTL + in-flight read cache for GitHub reads.
 *
 * Keeps results keyed by an explicit string (the caller is responsible for
 * including account/project/owner in the key so entries are scoped correctly).
 * Concurrent calls for the same key share one in-flight promise; resolved
 * values are reused until the TTL elapses.
 */

interface CacheEntry<T> {
  value?: T;
  expiresAt: number;
  inFlight?: Promise<T>;
}

export class GitHubReadCache {
  private store = new Map<string, CacheEntry<unknown>>();

  /**
   * Return the cached value for `key` if fresh, otherwise run `loader`. While a
   * load is in flight, concurrent callers for the same key share it.
   *
   * @param ttlMs 0 disables caching of the resolved value (still dedupes
   *              concurrent in-flight calls).
   */
  async get<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
    const now = Date.now();
    const existing = this.store.get(key) as CacheEntry<T> | undefined;

    if (existing) {
      if (existing.value !== undefined && existing.expiresAt > now) {
        return existing.value;
      }
      if (existing.inFlight) {
        return existing.inFlight;
      }
    }

    const entry: CacheEntry<T> = existing ?? { expiresAt: 0 };
    const promise = loader()
      .then((value) => {
        if (ttlMs > 0) {
          entry.value = value;
          entry.expiresAt = Date.now() + ttlMs;
        } else {
          entry.value = undefined;
          entry.expiresAt = 0;
        }
        entry.inFlight = undefined;
        return value;
      })
      .catch((err) => {
        // Failed loads are not cached; drop the entry so the next call retries.
        if (this.store.get(key) === entry) this.store.delete(key);
        throw err;
      });

    entry.inFlight = promise;
    this.store.set(key, entry);
    return promise;
  }

  /** Drop a single key (e.g. after a mutation invalidates it). */
  invalidate(key: string) {
    this.store.delete(key);
  }

  /** Drop all keys with the given prefix (e.g. all entries for an account). */
  invalidatePrefix(prefix: string) {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) this.store.delete(key);
    }
  }

  /** Test/diagnostic helper. */
  clear() {
    this.store.clear();
  }
}

/** TTLs (ms) for the various read types. */
export const READ_CACHE_TTL = {
  /** Project list changes rarely during a session. */
  userProjects: 30_000,
  /** Repository node IDs are effectively immutable. */
  repositoryId: 10 * 60_000,
};

export const githubReadCache = new GitHubReadCache();
