import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { ipBans } from "@/db/schema";
import { requireAdmin } from "@/server/auth";
import { invalidateBanCache } from "@/server/bans";
import { logAdmin } from "@/server/data";
import { getIp, HttpError, jsonError, readJson } from "@/server/http";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    requireAdmin(req);
    const rows = await db.select().from(ipBans).orderBy(desc(ipBans.createdAt)).limit(200);
    return Response.json({
      items: rows.map((row) => ({
        id: row.id,
        ip: row.ip,
        reason: row.reason,
        active: row.active,
        createdAt: row.createdAt.toISOString(),
        expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
      })),
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(req: Request) {
  try {
    requireAdmin(req);
    const body = await readJson(req) as { ip?: string; reason?: string; hours?: string | number };
    const ip = (body.ip || "").trim();
    if (!ip || ip.length > 80) throw new HttpError(400, "IP 无效");
    const hours = Number(body.hours ?? 24);
    const expiresAt = !Number.isFinite(hours) || hours <= 0 ? null : new Date(Date.now() + hours * 60 * 60 * 1000);
    await db.update(ipBans).set({ active: false }).where(eq(ipBans.ip, ip));
    await db.insert(ipBans).values({
      ip,
      reason: (body.reason || "").trim().slice(0, 200) || null,
      active: true,
      expiresAt,
    });
    invalidateBanCache();
    await logAdmin("ban_ip", `${ip} ${hours}`, getIp(req));
    return Response.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
