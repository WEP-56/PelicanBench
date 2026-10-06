import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { adminLogs, trafficEvents } from "@/db/schema";
import { requireAdmin } from "@/server/auth";
import { jsonError } from "@/server/http";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    requireAdmin(req);
    const url = new URL(req.url);
    const type = url.searchParams.get("type") === "admin" ? "admin" : "traffic";
    if (type === "admin") {
      const rows = await db.select().from(adminLogs).orderBy(desc(adminLogs.createdAt)).limit(80);
      return Response.json({
        items: rows.map((row) => ({
          id: row.id,
          createdAt: row.createdAt.toISOString(),
          action: row.action,
          detail: row.detail,
          ip: row.ip,
        })),
      });
    }
    const event = url.searchParams.get("event");
    const rows = await db
      .select()
      .from(trafficEvents)
      .where(event ? eq(trafficEvents.event, event) : undefined)
      .orderBy(desc(trafficEvents.createdAt))
      .limit(80);
    return Response.json({
      items: rows.map((row) => ({
        id: row.id,
        createdAt: row.createdAt.toISOString(),
        event: row.event,
        path: row.path,
        ip: row.ip,
        userAgent: row.userAgent,
        referrer: row.referrer,
        meta: row.meta,
      })),
    });
  } catch (error) {
    return jsonError(error);
  }
}
