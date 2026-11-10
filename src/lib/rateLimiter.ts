type Key = string;

interface Entry {
  count: number;
  windowStart: number;
}

const store = new Map<Key, Entry>();

export function rateLimit(key: Key, limit = 30, windowMs = 15 * 60 * 1000) {
  const now = Date.now();
  const ent = store.get(key);
  if (!ent) {
    store.set(key, { count: 1, windowStart: now });
    return { allowed: true, remaining: limit - 1, reset: now + windowMs };
  }

  if (now - ent.windowStart > windowMs) {
    store.set(key, { count: 1, windowStart: now });
    return { allowed: true, remaining: limit - 1, reset: now + windowMs };
  }

  if (ent.count >= limit) {
    return { allowed: false, remaining: 0, reset: ent.windowStart + windowMs };
  }

  ent.count += 1;
  store.set(key, ent);
  return { allowed: true, remaining: Math.max(0, limit - ent.count), reset: ent.windowStart + windowMs };
}

export function resetRateLimit(key: Key) {
  store.delete(key);
}
