import { hasLiveAccess, liveAccessEnabled, unlockLive } from "@/lib/live-access";
export const runtime = "nodejs";
export async function GET(request: Request) {
  return Response.json({ authenticated: hasLiveAccess(request), enabled: liveAccessEnabled() }, { headers: { "Cache-Control": "no-store" } });
}
export async function POST(request: Request) {
  try {
    const origin = request.headers.get("origin");
    if (origin && new URL(origin).host !== (request.headers.get("host") || new URL(request.url).host)) return Response.json({ error: "Request origin is not allowed." }, { status: 403 });
    const raw = await request.text();
    if (raw.length > 2000) return Response.json({ error: "Request too large." }, { status: 413 });
    const { code, consent } = JSON.parse(raw);
    return unlockLive(code, consent, request);
  } catch { return Response.json({ error: "Invalid access request." }, { status: 400 }); }
}
