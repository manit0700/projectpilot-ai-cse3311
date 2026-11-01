import { createHmac, timingSafeEqual } from "node:crypto";

const cookieName = "projectpilot-live";
const ttl = 8 * 60 * 60;
function same(a: string, b: string) {
  const left = Buffer.from(a), right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
function signature(value: string, key: string) { return createHmac("sha256", key).update(value).digest("hex"); }
export function liveAccessEnabled() { return Boolean(process.env.LIVE_ACCESS_CODE?.trim()); }
export function hasLiveAccess(request: Request) {
  const key = process.env.LIVE_ACCESS_CODE?.trim();
  // Development can run without a gate. Production fails closed when unconfigured.
  if (!key) return process.env.NODE_ENV !== "production";
  const token = request.headers.get("cookie")?.split(";").map((s) => s.trim()).find((s) => s.startsWith(cookieName + "="))?.slice(cookieName.length + 1) || "";
  const [expires, mac] = token.split(".");
  return /^\d+$/.test(expires || "") && Number(expires) > Date.now() && Number(expires) <= Date.now() + ttl * 1000 && same(mac || "", signature(expires, key));
}
export function requireLiveAccess(request: Request): Response | null {
  if (hasLiveAccess(request)) return null;
  return Response.json({ error: liveAccessEnabled() ? "Unlock Live API and accept the data-sharing notice before making live requests." : "Production live access is not configured. Demo mode remains available." }, { status: liveAccessEnabled() ? 401 : 503 });
}
export function unlockLive(code: unknown, consent: unknown, request: Request): Response {
  const key = process.env.LIVE_ACCESS_CODE?.trim();
  if (!key && process.env.NODE_ENV === "production") return Response.json({ error: "Live access is not configured." }, { status: 503 });
  if (consent !== true) return Response.json({ error: "Accept the data-sharing notice to use Live API." }, { status: 400 });
  if (key && (typeof code !== "string" || !same(code, key))) return Response.json({ error: "Access code is incorrect. Ask your project owner for access." }, { status: 401 });
  const expires = String(Date.now() + ttl * 1000);
  const token = key ? `${expires}.${signature(expires, key)}` : "";
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return Response.json({ authenticated: true }, { headers: { "Set-Cookie": `${cookieName}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${ttl}${secure}`, "Cache-Control": "no-store" } });
}
