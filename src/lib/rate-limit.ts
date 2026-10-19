// Small in-memory limiter for the login endpoint. On serverless hosts each warm
// instance keeps its own counts, so this slows brute force down rather than
// guaranteeing a global limit.
type Entry = { count: number; resetAt: number };
const buckets = new Map<string, Entry>();

export function takeToken(key: string, limit: number, windowMs: number): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const entry = buckets.get(key);
  if (!entry || entry.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }
  entry.count += 1;
  return { allowed: entry.count <= limit, retryAfterSeconds: Math.ceil((entry.resetAt - now) / 1000) };
}

export function resetTokens(key: string) {
  buckets.delete(key);
}
