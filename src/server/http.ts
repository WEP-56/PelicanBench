import { REQUEST_TOKEN_HEADER, REQUEST_TOKEN_REJECTED } from "@/lib/request-verification";
import { verifyRequestToken } from "./request-verification";

const buckets = new Map<string, number[]>();

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string, public readonly code?: string) {
    super(message);
    this.status = status;
  }
}

export function jsonError(error: unknown) {
  if (error instanceof HttpError) {
    return Response.json({ error: error.message, ...(error.code ? { code: error.code } : {}) }, { status: error.status });
  }
  console.error(error);
  return Response.json({ error: "服务器暂时无法完成请求" }, { status: 500 });
}

export function getIp(req: Request) {
  return ipFromGetter((name) => req.headers.get(name));
}

export function ipFromGetter(get: (name: string) => string | null) {
  const forwarded = get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first.slice(0, 80);
  }
  const real = get("x-real-ip")?.trim();
  return real ? real.slice(0, 80) : "0.0.0.0";
}

function assertAllowedSource(source: string, req: Request) {
  let sourceUrl: URL;
  try {
    sourceUrl = new URL(source);
    if (!["https:", "http:"].includes(sourceUrl.protocol) || sourceUrl.username || sourceUrl.password) throw new Error("invalid source");
  } catch {
    throw new HttpError(403, "来源不被允许");
  }

  // Pin the public origin in production, or use the trusted reverse proxy's
  // external host rather than comparing against an internal service address.
  const configuredOrigin = process.env.APP_URL;
  if (configuredOrigin) {
    let allowed: URL;
    try {
      allowed = new URL(configuredOrigin);
      if (!["https:", "http:"].includes(allowed.protocol) || allowed.username || allowed.password) throw new Error("invalid APP_URL");
    } catch {
      throw new HttpError(503, "站点 APP_URL 配置无效");
    }
    if (sourceUrl.origin !== allowed.origin) throw new HttpError(403, "请求来源与当前站点不一致，请刷新页面后重试");
    return;
  }

  const forwardedHost = req.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || req.headers.get("host") || new URL(req.url).host;
  let allowedHost: string;
  try {
    const target = new URL(`${sourceUrl.protocol}//${host}`);
    if (target.username || target.password || target.pathname !== "/" || target.search || target.hash) throw new Error("invalid host");
    allowedHost = target.host;
  } catch {
    throw new HttpError(403, "来源不被允许");
  }
  if (sourceUrl.host !== allowedHost) throw new HttpError(403, "请求来源与当前站点不一致，请刷新页面后重试");
}

export function assertSameOrigin(req: Request) {
  const origin = req.headers.get("origin")?.trim();
  const fetchSite = req.headers.get("sec-fetch-site")?.trim().toLowerCase();
  const referer = req.headers.get("referer")?.trim();

  // A proof never overrides an explicitly foreign request.
  if (fetchSite === "cross-site") throw new HttpError(403, "不允许跨站提交");
  if (origin && origin !== "null") {
    assertAllowedSource(origin, req);
    return;
  }
  if (referer) {
    assertAllowedSource(referer, req);
    if (!origin) return;
  }
  if (!origin && fetchSite === "same-origin") return;

  // Privacy tools / preview gateways may remove Origin, Referer and Fetch
  // Metadata. Verify an in-memory, expiring page proof instead of failing open.
  // An opaque (null) origin also needs proof; it is not generally trusted.
  if (verifyRequestToken(req.headers.get(REQUEST_TOKEN_HEADER))) return;
  throw new HttpError(
    403,
    "页面请求校验已失效，请刷新页面后重试；若仍失败，请在独立窗口打开本站。",
    REQUEST_TOKEN_REJECTED,
  );
}

export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const fresh = (buckets.get(key) ?? []).filter((stamp) => now - stamp < windowMs);
  if (fresh.length >= limit) {
    buckets.set(key, fresh);
    return false;
  }
  fresh.push(now);
  buckets.set(key, fresh);
  if (buckets.size > 4000) {
    for (const [bucketKey, stamps] of buckets) {
      if (stamps.every((stamp) => now - stamp >= windowMs)) buckets.delete(bucketKey);
    }
  }
  return true;
}

export async function readJson(req: Request) {
  try {
    return await req.json();
  } catch {
    throw new HttpError(400, "请求不是有效的 JSON");
  }
}
