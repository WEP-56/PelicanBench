import { eq } from "drizzle-orm";
import { db } from "@/db";
import { publicResults } from "@/db/schema";
import { requireAdmin } from "@/server/auth";
import { getResult, logAdmin, toAdmin } from "@/server/data";
import { resolveBase } from "@/lib/endpoints";
import { getIp, HttpError, jsonError, readJson } from "@/server/http";

export const dynamic = "force-dynamic";

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    requireAdmin(req);
    const { id } = await context.params;
    const row = await getResult(id);
    if (!row) throw new HttpError(404, "没有这条记录");
    return Response.json(toAdmin(row, true));
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    requireAdmin(req);
    const { id } = await context.params;
    const existing = await getResult(id);
    if (!existing) throw new HttpError(404, "没有这条记录");
    const body = await readJson(req) as Record<string, unknown>;
    const patch: Partial<typeof publicResults.$inferInsert> = {};
    if (body.status === "hidden" || body.status === "published") patch.status = body.status;
    if (typeof body.model === "string" && body.model.trim()) patch.model = body.model.trim().slice(0, 120);
    if (typeof body.nickname === "string") patch.nickname = body.nickname.trim().slice(0, 24) || "匿名测试者";
    if (typeof body.note === "string") patch.note = body.note.trim().slice(0, 280) || null;
    if (typeof body.verdict === "string" && ["", "authentic", "unsure", "degraded"].includes(body.verdict)) {
      patch.verdict = body.verdict || null;
    }
    if (body.channel === "official") {
      patch.channel = "official";
      patch.baseUrl = null;
    }
    if (body.channel === "third_party") {
      if (typeof body.baseUrl !== "string") throw new HttpError(400, "第三方需要 Base URL");
      const resolved = resolveBase(body.baseUrl, true);
      if ("error" in resolved) throw new HttpError(400, resolved.error);
      patch.channel = "third_party";
      patch.baseUrl = resolved.href;
    } else if (typeof body.baseUrl === "string" && body.channel !== "official") {
      if (!body.baseUrl.trim()) patch.baseUrl = null;
      else {
        const resolved = resolveBase(body.baseUrl, true);
        if ("error" in resolved) throw new HttpError(400, resolved.error);
        patch.baseUrl = resolved.href;
      }
    }
    await db.update(publicResults).set(patch).where(eq(publicResults.id, id));
    await logAdmin("update_result", `${id} ${JSON.stringify(patch).slice(0, 500)}`, getIp(req));
    return Response.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    requireAdmin(req);
    const { id } = await context.params;
    await db.delete(publicResults).where(eq(publicResults.id, id));
    await logAdmin("delete_result", id, getIp(req));
    return Response.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
