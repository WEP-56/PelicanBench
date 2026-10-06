import { requireAdmin } from "@/server/auth";
import { logAdmin, queryResults, toAdmin, validateSubmission } from "@/server/data";
import { db } from "@/db";
import { publicResults } from "@/db/schema";
import { getIp, jsonError, readJson } from "@/server/http";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    requireAdmin(req);
    const url = new URL(req.url);
    const { rows, total, page, pageSize } = await queryResults({
      q: url.searchParams.get("q") ?? undefined,
      status: url.searchParams.get("status") ?? "all",
      kind: url.searchParams.get("kind") ?? "all",
      page: Number(url.searchParams.get("page") ?? "1"),
      pageSize: 20,
      includeHidden: true,
    });
    return Response.json({ items: rows.map((row) => toAdmin(row, false)), total, page, pageSize });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(req: Request) {
  try {
    requireAdmin(req);
    const body = validateSubmission(await readJson(req), true);
    const id = crypto.randomUUID();
    const ip = getIp(req);
    await db.insert(publicResults).values({
      id,
      kind: "submission",
      status: "published",
      ...body,
      ip,
      userAgent: "admin",
    });
    await logAdmin("create_result", id, ip);
    return Response.json({ id });
  } catch (error) {
    return jsonError(error);
  }
}
