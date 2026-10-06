import { clearSessionCookie, requireAdmin } from "@/server/auth";
import { logAdmin } from "@/server/data";
import { assertSameOrigin, getIp, jsonError } from "@/server/http";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    requireAdmin(req);
    await logAdmin("logout", "退出管理", getIp(req));
    return Response.json({ ok: true }, { headers: { "Set-Cookie": clearSessionCookie() } });
  } catch (error) {
    return jsonError(error);
  }
}
