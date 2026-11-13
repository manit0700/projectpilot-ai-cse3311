import { readJsonBody, sameOrigin } from "@/lib/api-guard";
import { hasLiveAccess, liveAccessConfigured, liveAccessEnabled, unlockLive } from "@/lib/live-access";
import { liveAccessLimiter, rateLimited } from "@/lib/rate-limit";
export const runtime = "nodejs";
// Only gate state is disclosed: whether a code is required, whether the server can
// honor it, and whether this caller's own cookie is valid. No provider details.
export async function GET(request: Request) {
  return Response.json({ authenticated: hasLiveAccess(request), enabled: liveAccessEnabled(), configured: liveAccessConfigured() }, { headers: { "Cache-Control": "no-store" } });
}
export async function POST(request: Request) {
  const foreign = sameOrigin(request); if (foreign) return foreign;
  const limited = rateLimited(liveAccessLimiter, request, "Too many unlock attempts. Wait ten minutes and try again."); if (limited) return limited;
  const body = await readJsonBody(request, 2000); if (!body.ok) return body.response;
  const { code, consent } = body.value as { code?: unknown; consent?: unknown };
  return unlockLive(code, consent, request);
}
