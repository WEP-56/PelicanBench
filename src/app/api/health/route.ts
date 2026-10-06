import { db } from "@/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await db.execute<{ ready: boolean }>(sql`
      select (
        to_regclass('public_results') is not null
        and to_regclass('traffic_events') is not null
        and to_regclass('ip_bans') is not null
        and to_regclass('admin_logs') is not null
      ) as ready
    `);
    if (!result.rows[0]?.ready) {
      return Response.json({
        ok: false,
        database: true,
        schemaReady: false,
        error: "数据库表尚未初始化，请运行 npx drizzle-kit push 后重试。",
      }, { status: 503, headers: { "Cache-Control": "no-store" } });
    }
    return Response.json({
      ok: true,
      database: true,
      schemaReady: true,
      adminConfigured: Boolean(process.env.ADMIN_PASSWORD),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({
      ok: false,
      database: false,
      error: "无法连接数据库，请检查 PostgreSQL 服务和 DATABASE_URL。",
    }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
