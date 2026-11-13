import { failure } from "./provider-errors";
// Small in-memory fixed-window limiter for abuse-prone API routes.
//
// LIMITATION: on Vercel (and any multi-instance host) this state lives inside one
// function instance, so an attacker spread across instances or cold starts sees a
// much looser effective limit. Treat this as defense in depth only; the real
// control is a platform rate-limit rule (Vercel WAF / Firewall) in front of
// /api/live-access and /api/studio*.
export type RateLimiter = {
  check(key: string, now?: number): { allowed: boolean; remaining: number; retryAfterSeconds: number };
  reset(): void;
};
type Window = { count: number; resetAt: number };
const maxTrackedKeys = 5000;
export function createRateLimiter(options: { limit: number; windowMs: number }): RateLimiter {
  const { limit, windowMs } = options;
  const windows = new Map<string, Window>();
  function prune(now: number) {
    if (windows.size < maxTrackedKeys) return;
    for (const [key, entry] of windows) if (entry.resetAt <= now) windows.delete(key);
    // Still oversubscribed after pruning expired windows: drop the oldest entries so memory stays bounded.
    while (windows.size >= maxTrackedKeys) { const oldest = windows.keys().next().value; if (oldest === undefined) break; windows.delete(oldest); }
  }
  return {
    check(key, now = Date.now()) {
      let entry = windows.get(key);
      if (!entry || entry.resetAt <= now) { prune(now); entry = { count: 0, resetAt: now + windowMs }; windows.set(key, entry); }
      entry.count += 1;
      const allowed = entry.count <= limit;
      return { allowed, remaining: Math.max(0, limit - entry.count), retryAfterSeconds: allowed ? 0 : Math.max(1, Math.ceil((entry.resetAt - now) / 1000)) };
    },
    reset() { windows.clear(); }
  };
}
// First hop of x-forwarded-for. On Vercel the platform sets this header from the
// TCP peer, so the first hop is the client. On self-hosted deployments without a
// trusted proxy the header is client-controlled and this key is only advisory.
export function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || request.headers.get("x-real-ip")?.trim() || "unknown";
  return ip.slice(0, 64);
}
export function rateLimited(limiter: RateLimiter, request: Request, message = "Too many requests. Wait a few minutes and try again."): Response | null {
  const result = limiter.check(clientKey(request));
  if (result.allowed) return null;
  return failure(message, 429, "quota", { scope: "minute", retryAfterSeconds: result.retryAfterSeconds }, { "Retry-After": String(result.retryAfterSeconds), "Cache-Control": "no-store" });
}
// Shared instances: module state persists for the life of one server instance.
export const liveAccessLimiter = createRateLimiter({ limit: 10, windowMs: 10 * 60 * 1000 });
export const studioLimiter = createRateLimiter({ limit: 60, windowMs: 10 * 60 * 1000 });
// Planner routes (/api/manager, /api/specialist): about 60 calls per 10 minutes per client IP, tunable with
// PLANNER_RATE_LIMIT. Same per-instance caveat as above: on a multi-instance host this is advisory, and the
// platform firewall rule is the real control. Read once when the server module loads.
const plannerLimit = Number.parseInt(process.env.PLANNER_RATE_LIMIT ?? "", 10);
export const plannerLimiter = createRateLimiter({ limit: Number.isFinite(plannerLimit) && plannerLimit > 0 ? plannerLimit : 60, windowMs: 10 * 60 * 1000 });
