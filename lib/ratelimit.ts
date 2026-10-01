// Simple process-local token-bucket rate limiter for anonymous submissions.
//
// LIMITATION: state lives in this Node process only. With multiple server
// instances (or serverless), each instance enforces its own budget. That is
// acceptable for this MVP: it stops casual spam/abuse without adding
// Redis-backed infrastructure. For multi-instance deployments, replace with
// a Redis counter.

const buckets = new Map<string, number[]>();

export function isRateLimited(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const hits = buckets.get(key) ?? [];
  const fresh = hits.filter((t) => now - t < windowMs);
  if (fresh.length >= limit) {
    buckets.set(key, fresh);
    return true;
  }
  fresh.push(now);
  buckets.set(key, fresh);
  return false;
}

export function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "anon";
  return "anon";
}

export const MAX_CODE_BYTES = 64 * 1024;

export function isDevEnvironment(): boolean {
  return process.env["NODE_ENV"] !== "production";
}
