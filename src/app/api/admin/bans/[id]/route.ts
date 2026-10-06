import { eq } from "drizzle-orm";
import { db } from "@/db";
import { ipBans } from "@/db/schema";
import { requireAdmin } from "@/server/auth";
import { invalidateBanCache } from "@/server/bans";
import { logAdmin } from "@/server/data";
import { getIp, jsonError } from "@/server/http";

export const dynamic = "force-dynamic";

export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    requireAdmin(req);
    const { id } = await context.params;
    await db.update(ipBans).set({ active: false }).where(eq(ipBans.id, Number(id)));
    invalidateBanCache();
    await logAdmin("unban_ip", id, getIp(req));
    return Response.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
