import { assertNotBanned } from "@/server/bans";
import { logEvent } from "@/server/data";
import { getIp, rateLimit, readJson } from "@/server/http";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const ip = getIp(req);
  try {
    await assertNotBanned(ip);
  } catch {
    return Response.json({ ok: false }, { status: 403 });
  }
  if (!rateLimit(`telemetry:${ip}`, 120, 60 * 60 * 1000)) return Response.json({ ok: true });
  const body = await readJson(req).catch(() => ({} as Record<string, unknown>));
  const record = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const path = typeof record.path === "string" ? record.path.slice(0, 300) : "/";
  const event = record.event === "pageview" ? "pageview" : "pageview";
  await logEvent({
    event,
    path,
    ip,
    userAgent: req.headers.get("user-agent"),
    referrer: typeof record.referrer === "string" ? record.referrer : req.headers.get("referer"),
  });
  return Response.json({ ok: true });
}
