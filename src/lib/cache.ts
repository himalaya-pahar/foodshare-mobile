interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttlMs: number;
}

const memoryCache = new Map<string, CacheEntry<unknown>>();

/**
 * Returns cached data if available (supports stale-while-revalidate).
 */
export function getCachedData<T>(key: string): T | null {
  const entry = memoryCache.get(key);
  if (!entry) return null;
  return entry.data as T;
}

/**
 * Checks whether cached data has exceeded its TTL.
 */
export function isCacheStale(key: string): boolean {
  const entry = memoryCache.get(key);
  if (!entry) return true;
  return Date.now() - entry.timestamp > entry.ttlMs;
}

/**
 * Stores data in memory with a given TTL (default 60 seconds).
 */
export function setCachedData<T>(key: string, data: T, ttlMs = 60_000): void {
  memoryCache.set(key, {
    data,
    timestamp: Date.now(),
    ttlMs,
  });
}

/**
 * Invalidates cache by exact key or key prefix.
 */
export function invalidateCache(keyPrefix?: string): void {
  if (!keyPrefix) {
    memoryCache.clear();
    return;
  }
  for (const key of memoryCache.keys()) {
    if (key.startsWith(keyPrefix)) {
      memoryCache.delete(key);
    }
  }
}
