import { getIp, HttpError, jsonError, rateLimit } from "@/server/http";
import { issueRequestToken } from "@/server/request-verification";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    if (req.headers.get("sec-fetch-site") === "cross-site") throw new HttpError(403, "不允许跨站获取校验信息");
    if (!rateLimit(`request-token:${getIp(req)}`, 120, 10 * 60 * 1000)) throw new HttpError(429, "请求过于频繁，请稍后重试");
    // This read-only endpoint intentionally supports clients without metadata
    // headers. No CORS access is granted: another origin cannot read its JSON.
    return Response.json(issueRequestToken(), {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        "Surrogate-Control": "no-store",
        "Cross-Origin-Resource-Policy": "same-origin",
        "X-Content-Type-Options": "nosniff",
        Vary: "Origin, Sec-Fetch-Site",
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
