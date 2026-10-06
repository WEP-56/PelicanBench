import { db } from "@/db";
import { publicResults } from "@/db/schema";
import { assertNotBanned } from "@/server/bans";
import { queryResults, toPublic, validateSubmission, logEvent } from "@/server/data";
import { assertSameOrigin, getIp, HttpError, jsonError, rateLimit, readJson } from "@/server/http";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const ip = getIp(req);
    await assertNotBanned(ip);
    const url = new URL(req.url);
    const page = Number(url.searchParams.get("page") ?? "1");
    const pageSize = Number(url.searchParams.get("pageSize") ?? "12");
    const { rows, total, page: current, pageSize: size } = await queryResults({
      kind: url.searchParams.get("kind") ?? "submission",
      channel: url.searchParams.get("channel") ?? undefined,
      protocol: url.searchParams.get("protocol") ?? undefined,
      thinking: url.searchParams.get("thinking") ?? undefined,
      verdict: url.searchParams.get("verdict") ?? undefined,
      q: url.searchParams.get("q") ?? undefined,
      sort: url.searchParams.get("sort") ?? "new",
      page,
      pageSize,
    });
    return Response.json({ items: rows.map((row) => toPublic(row)), total, page: current, pageSize: size });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const ip = getIp(req);
    await assertNotBanned(ip);
    if (!rateLimit(`upload:${ip}`, 12, 60 * 60 * 1000)) throw new HttpError(429, "公示太频繁，请稍后再试");
    const body = validateSubmission(await readJson(req));
    const id = crypto.randomUUID();
    await db.insert(publicResults).values({
      id,
      kind: "submission",
      status: "published",
      ...body,
      ip,
      userAgent: req.headers.get("user-agent")?.slice(0, 300) ?? null,
    });
    await logEvent({
      event: "upload",
      path: "/api/results",
      ip,
      userAgent: req.headers.get("user-agent"),
      meta: { model: body.model, channel: body.channel, protocol: body.protocol },
    });
    return Response.json({ id });
  } catch (error) {
    return jsonError(error);
  }
}
