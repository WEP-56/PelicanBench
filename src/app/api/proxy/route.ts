import { assertNotBanned } from "@/server/bans";
import { logEvent } from "@/server/data";
import { assertSameOrigin, getIp, HttpError, jsonError, rateLimit, readJson } from "@/server/http";
import { assertPublicUrl } from "@/server/ssrf";
import { HeaderConfigError, validateForwardHeaders } from "@/lib/request-headers";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function readLimited(response: Response, max: number) {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel();
      throw new HttpError(413, "上游响应超过 4MB，已中止");
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

export async function POST(req: Request) {
  const started = Date.now();
  const ip = getIp(req);
  let host = "";
  let pathname = "";
  try {
    assertSameOrigin(req);
    await assertNotBanned(ip);
    if (!rateLimit(`proxy:${ip}`, 40, 10 * 60 * 1000)) throw new HttpError(429, "中转过于频繁");
    const parsed: unknown = await readJson(req);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new HttpError(400, "请求格式无效");
    const body = parsed as Record<string, unknown>;
    const method = body.method === "GET" ? "GET" : body.method === "POST" ? "POST" : "";
    if (!method) throw new HttpError(400, "只允许 GET 或 POST");
    if (typeof body.url !== "string") throw new HttpError(400, "缺少目标地址");
    // Validate prior to DNS/fetch; never copy req.headers into the upstream.
    const headers = validateForwardHeaders(body.headers);
    const target = await assertPublicUrl(body.url);
    host = target.hostname;
    pathname = target.pathname;
    let payload: string | undefined;
    if (method === "POST") {
      payload = typeof body.body === "string" ? body.body : JSON.stringify(body.body ?? {});
      if (payload.length > 1_000_000) throw new HttpError(413, "请求体过大");
      if (!headers.has("content-type")) headers.set("content-type", "application/json");
    }
    const upstream = await fetch(target, {
      method, headers, body: payload, redirect: "error", signal: AbortSignal.timeout(170_000),
    });
    const text = await readLimited(upstream, 4_000_000);
    await logEvent({
      event: "proxy", path: "/api/proxy", ip,
      meta: { host, pathname, status: upstream.status, durationMs: Date.now() - started },
    }).catch(() => undefined);
    return Response.json({
      status: upstream.status, body: text, contentType: upstream.headers.get("content-type") || "application/json",
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof HeaderConfigError) return Response.json({ error: error.message }, { status: 400 });
    if (error instanceof HttpError) return jsonError(error);
    // Fetch exceptions can contain header values. Record only a fixed category.
    await logEvent({
      event: "proxy_error", path: "/api/proxy", ip,
      meta: { host, pathname, category: "upstream_request_failed", durationMs: Date.now() - started },
    }).catch(() => undefined);
    return Response.json({ error: "一次性中转失败，请检查地址与网络。密钥和请求头未保存。" }, { status: 502 });
  }
}
