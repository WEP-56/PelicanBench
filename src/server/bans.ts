import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { ipBans } from "@/db/schema";
import { HttpError } from "./http";

type CachedBan = { ip: string; reason: string | null; expiresAt: number | null };
let cache: { at: number; items: CachedBan[] } | null = null;

export function invalidateBanCache() {
  cache = null;
}

export async function listActiveBans() {
  const now = Date.now();
  if (!cache || now - cache.at > 15000) {
    const rows = await db.select().from(ipBans).where(eq(ipBans.active, true));
    cache = {
      at: now,
      items: rows.map((row) => ({
        ip: row.ip,
        reason: row.reason,
        expiresAt: row.expiresAt ? row.expiresAt.getTime() : null,
      })),
    };
  }
  return cache.items.filter((item) => !item.expiresAt || item.expiresAt > now);
}

export async function findActiveBan(ip: string) {
  const items = await listActiveBans();
  return items.find((item) => item.ip === ip) ?? null;
}

export async function assertNotBanned(ip: string) {
  const ban = await findActiveBan(ip);
  if (!ban) return;
  throw new HttpError(403, ban.reason ? `此网络地址已被限制访问：${ban.reason}` : "此网络地址已被限制访问");
}

export async function deactivateBan(id: number) {
  await db.update(ipBans).set({ active: false }).where(and(eq(ipBans.id, id), eq(ipBans.active, true)));
  invalidateBanCache();
}
