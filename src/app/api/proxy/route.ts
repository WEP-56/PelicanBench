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

function proxyFailure(error: unknown) {
  const value = error && typeof error === "object" ? error as { name?: unknown; cause?: { code?: unknown } } : {};
  const name = typeof value.name === "string" ? value.name : "";
  const code = typeof value.cause?.code === "string" ? value.cause.code : "";
  if (name === "TimeoutError" || ["ETIMEDOUT", "UND_ERR_CONNECT_TIMEOUT", "UND_ERR_HEADERS_TIMEOUT"].includes(code)) {
    return { category: "upstream_timeout", message: "连接模型服务超时，请检查服务商状态和网络后重试。" };
  }
  if (["ENOTFOUND", "EAI_AGAIN", "EAI_FAIL"].includes(code)) {
    return { category: "upstream_dns_failure", message: "无法解析模型服务域名，请检查 Base URL 和当前网络的 DNS。" };
  }
  if (["ECONNREFUSED", "ECONNRESET", "EHOSTUNREACH", "ENETUNREACH"].includes(code)) {
    return { category: "upstream_connection_failure", message: "无法连接模型服务，请检查地址、端口和网络是否允许本站服务器出站访问。" };
  }
  if (/CERT|TLS|SSL|SELF_SIGNED/i.test(code)) {
    return { category: "upstream_tls_failure", message: "模型服务的 TLS 证书验证失败，请检查 HTTPS 地址和证书配置。" };
  }
  return { category: "upstream_request_failed", message: "模型服务请求失败，请检查地址与网络。密钥和请求头未保存。" };
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
    let target: URL;
    try {
      target = await assertPublicUrl(body.url);
    } catch (error) {
      throw new HttpError(400, error instanceof Error ? error.message : "目标地址校验失败");
    }
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
    const failure = proxyFailure(error);
    await logEvent({
      event: "proxy_error", path: "/api/proxy", ip,
      meta: { host, pathname, category: failure.category, durationMs: Date.now() - started },
    }).catch(() => undefined);
    return Response.json({ error: failure.message }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
