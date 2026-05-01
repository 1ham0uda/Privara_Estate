interface RateEntry {
  count: number;
  reset: number;
}

// Per-instance in-memory store. Sufficient for single-container deployments.
// For multi-instance deployments, replace with Redis or Firestore-backed store.
const store = new Map<string, RateEntry>();

// Evict expired entries every 5 minutes to prevent unbounded memory growth.
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (now > entry.reset) store.delete(key);
    }
  }, 5 * 60 * 1000);
}

/**
 * Returns true if the request is within the allowed rate.
 * @param key      Unique identifier, typically `${route}:${ip}` or `${route}:${uid}`
 * @param limit    Maximum requests allowed within the window
 * @param windowMs Duration of the window in milliseconds
 */
export function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.reset) {
    store.set(key, { count: 1, reset: now + windowMs });
    return true;
  }

  if (entry.count >= limit) return false;

  entry.count++;
  return true;
}

export function rateLimitResponse() {
  return new Response(JSON.stringify({ error: 'Too many requests. Please try again later.' }), {
    status: 429,
    headers: { 'Content-Type': 'application/json', 'Retry-After': '60' },
  });
}
