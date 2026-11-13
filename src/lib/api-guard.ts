// Shared request guards for every JSON API route (manager, specialist, studio, live-access).
import { failure } from "./provider-errors";
export { failure } from "./provider-errors";
export function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null; }

// Same-origin check for state-changing requests. Browsers always send Origin on
// POST, so in production a missing header is treated as a cross-site or non-browser
// request and refused rather than silently skipped. Outside production (tests, local
// scripts, curl) an absent Origin is accepted; a present one must always match.
// The expected origin is taken from the request URL and, behind a proxy, from the
// forwarded protocol plus Host header.
export function sameOrigin(request: Request): Response | null {
  const origin = request.headers.get("origin");
  if (!origin) return process.env.NODE_ENV === "production" ? failure("Request origin is required.", 403, "auth") : null;
  let expected: Set<string>;
  try {
    const url = new URL(request.url);
    expected = new Set([url.origin]);
    const host = request.headers.get("host");
    const proto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
    if (host && /^[\w.\-:[\]]+$/.test(host)) { expected.add(`${url.protocol}//${host}`); if (proto === "https" || proto === "http") expected.add(`${proto}://${host}`); }
  } catch { return failure("Request origin is not allowed.", 403, "auth"); }
  if (!expected.has(origin)) return failure("Request origin is not allowed.", 403, "auth");
  return null;
}
export type JsonBody = { ok: true; value: unknown } | { ok: false; response: Response };
// Reads and parses a JSON body with explicit 413 (oversize) and 400 (malformed)
// results so provider-failure handlers never swallow client errors.
export async function readJsonBody(request: Request, maxChars: number, tooLarge = "Request body is too large."): Promise<JsonBody> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxChars * 4) return { ok: false, response: failure(tooLarge, 413, "invalid") };
  let raw: string;
  try { raw = await request.text(); } catch { return { ok: false, response: failure("Request body could not be read.", 400, "invalid") }; }
  if (raw.length > maxChars) return { ok: false, response: failure(tooLarge, 413, "invalid") };
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) return { ok: false, response: failure("Request body must be a JSON object.", 400, "invalid") };
    return { ok: true, value };
  } catch { return { ok: false, response: failure("Request body is not valid JSON.", 400, "invalid") }; }
}
