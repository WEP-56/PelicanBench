import { createSessionToken, passwordsMatch, sessionCookie } from "@/server/auth";
import { logEvent } from "@/server/data";
import { assertSameOrigin, getIp, HttpError, jsonError, rateLimit, readJson } from "@/server/http";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const ip = getIp(req);
    if (!rateLimit(`login:${ip}`, 8, 15 * 60 * 1000)) throw new HttpError(429, "尝试过多，请稍后再试");
    const body = await readJson(req) as { password?: unknown };
    const expected = process.env.ADMIN_PASSWORD || "";
    if (!expected) throw new HttpError(503, "管理口令尚未配置，请设置 ADMIN_PASSWORD 并重启 Next.js 服务");
    if (typeof body.password !== "string" || !body.password || !passwordsMatch(body.password, expected)) {
      await logEvent({ event: "login_fail", path: "/api/admin/login", ip, userAgent: req.headers.get("user-agent") });
      throw new HttpError(401, "口令不正确");
    }
    const token = createSessionToken();
    await logEvent({ event: "login_ok", path: "/api/admin/login", ip, userAgent: req.headers.get("user-agent") });
    return Response.json({ ok: true }, { headers: { "Set-Cookie": sessionCookie(token, req) } });
  } catch (error) {
    return jsonError(error);
  }
}
