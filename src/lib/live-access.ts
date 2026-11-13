import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { failure } from "./provider-errors";

const cookieName = "projectpilot-live";
const ttl = 8 * 60 * 60;
export const minimumProductionCodeLength = 20;
// Compare HMAC digests of both inputs so the comparison is constant-time and
// reveals nothing about the length of the secret.
const comparisonKey = randomBytes(32);
function same(a: string, b: string) {
  const digest = (value: string) => createHmac("sha256", comparisonKey).update(value).digest();
  return timingSafeEqual(digest(a), digest(b));
}
// The cookie is signed with a key derived from the access code, never the code itself.
function cookieKey(code: string) { return createHmac("sha256", code).update("projectpilot-cookie").digest(); }
function signature(value: string, code: string) { return createHmac("sha256", cookieKey(code)).update(value).digest("hex"); }
function production() { return process.env.NODE_ENV === "production"; }
let warned = false;
function codeTooShort(code: string) {
  if (!production() || code.length >= minimumProductionCodeLength) return false;
  if (!warned) { warned = true; console.error(`LIVE_ACCESS_CODE is shorter than ${minimumProductionCodeLength} characters. Live access is disabled until a longer code is configured.`); }
  return true;
}
// Returns the usable access code, or null when none is set or it is too weak for production.
function usableCode(): string | null {
  const code = process.env.LIVE_ACCESS_CODE?.trim();
  if (!code || codeTooShort(code)) return null;
  return code;
}
export function liveAccessEnabled() { return Boolean(process.env.LIVE_ACCESS_CODE?.trim()); }
// True when the gate can actually be unlocked (code present and strong enough for this environment).
export function liveAccessConfigured() { return usableCode() !== null; }
export function hasLiveAccess(request: Request) {
  const key = usableCode();
  // Development can run without a gate. Production fails closed when unconfigured or misconfigured.
  if (!key) return !liveAccessEnabled() && !production();
  const token = request.headers.get("cookie")?.split(";").map((s) => s.trim()).find((s) => s.startsWith(cookieName + "="))?.slice(cookieName.length + 1) || "";
  const [expires, mac] = token.split(".");
  return /^\d+$/.test(expires || "") && Number(expires) > Date.now() && Number(expires) <= Date.now() + ttl * 1000 && same(mac || "", signature(expires, key));
}
export function requireLiveAccess(request: Request): Response | null {
  if (hasLiveAccess(request)) return null;
  if (liveAccessEnabled() && !liveAccessConfigured()) return failure("Live access is misconfigured on the server. Demo mode remains available.", 503, "auth");
  return failure(liveAccessEnabled() ? "Unlock Live API and accept the data-sharing notice before making live requests." : "Production live access is not configured. Demo mode remains available.", liveAccessEnabled() ? 401 : 503, "auth");
}
export function unlockLive(code: unknown, consent: unknown, request: Request): Response {
  const configured = process.env.LIVE_ACCESS_CODE?.trim();
  if (!configured && production()) return failure("Live access is not configured.", 503, "auth");
  if (configured && codeTooShort(configured)) return failure(`Live access is misconfigured: LIVE_ACCESS_CODE must be at least ${minimumProductionCodeLength} characters.`, 503, "auth");
  if (consent !== true) return failure("Accept the data-sharing notice to use Live API.", 400, "invalid");
  if (configured && (typeof code !== "string" || code.length > 512 || !same(code, configured))) return failure("Access code is incorrect. Ask your project owner for access.", 401, "auth");
  const expires = String(Date.now() + ttl * 1000);
  const token = configured ? `${expires}.${signature(expires, configured)}` : "";
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return Response.json({ authenticated: true }, { headers: { "Set-Cookie": `${cookieName}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${ttl}${secure}`, "Cache-Control": "no-store" } });
}
