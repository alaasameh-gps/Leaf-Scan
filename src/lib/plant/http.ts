export interface JsonFetchOptions {
  timeoutMs?: number;
  headers?: Record<string, string>;
}

/** fetch + JSON parse with a hard timeout so a slow third party never hangs a request. */
export async function fetchJson<T = unknown>(url: string, options: JsonFetchOptions = {}): Promise<T> {
  const { timeoutMs = 8000, headers } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      cache: "no-store",
      headers: { Accept: "application/json", ...(headers ?? {}) },
    });
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status} for ${new URL(url).host}`);
    }
    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const store = new Map<string, CacheEntry<unknown>>();

/** Small in-process TTL cache for third-party reference data. */
export async function cached<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = store.get(key);
  if (hit && hit.expiresAt > now) {
    return hit.value as T;
  }
  const value = await loader();
  if (store.size > 500) {
    for (const [entryKey, entry] of store) {
      if (entry.expiresAt <= now) store.delete(entryKey);
    }
  }
  store.set(key, { value, expiresAt: now + ttlMs });
  return value;
}

export function clearReferenceCache(): void {
  store.clear();
}
