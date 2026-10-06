import { REQUEST_TOKEN_HEADER, REQUEST_TOKEN_PATH, REQUEST_TOKEN_REJECTED, type RequestToken } from "./request-verification";

export class SiteRequestError extends Error {
  constructor(message: string, public readonly status = 0) {
    super(message);
    this.name = "SiteRequestError";
  }
}

// Kept only in this page's memory, never in storage or a cookie.
let cachedToken: RequestToken | null = null;

async function requestToken(signal?: AbortSignal | null, refresh = false) {
  signal?.throwIfAborted();
  if (!refresh && cachedToken && cachedToken.expiresAt > Date.now() + 30_000) return cachedToken.token;

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 10_000);
  const onAbort = () => controller.abort(signal?.reason);
  signal?.addEventListener("abort", onAbort, { once: true });
  let response: Response;
  try {
    response = await fetch(REQUEST_TOKEN_PATH, {
      method: "GET",
      headers: { Accept: "application/json" },
      credentials: "same-origin",
      mode: "same-origin",
      redirect: "error",
      cache: "no-store",
      signal: controller.signal,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new SiteRequestError("暂时无法获取本站请求校验信息，请稍后重试。模型尚未被调用。");
  } finally {
    window.clearTimeout(timeout);
    signal?.removeEventListener("abort", onAbort);
  }
  const data = await response.json().catch(() => null) as (Partial<RequestToken> & { error?: string }) | null;
  if (!response.ok || !data || typeof data.token !== "string" || typeof data.expiresAt !== "number" || data.expiresAt <= Date.now()) {
    throw new SiteRequestError(
      data?.error || "本站请求校验接口不可用，请刷新页面后重试。模型尚未被调用。",
      response.status,
    );
  }
  cachedToken = { token: data.token, expiresAt: data.expiresAt };
  return data.token;
}

/** Only for first-party APIs, never for a user-provided model endpoint. */
export async function siteFetch(path: string, init: RequestInit = {}) {
  if (!path.startsWith("/api/")) throw new SiteRequestError("本站接口必须使用站内相对地址");
  const method = (init.method || "GET").toUpperCase();
  const mutating = !["GET", "HEAD", "OPTIONS"].includes(method);
  const headers = new Headers(init.headers);
  if (mutating) headers.set(REQUEST_TOKEN_HEADER, await requestToken(init.signal));
  const send = () => fetch(path, {
    ...init,
    headers,
    credentials: "same-origin",
    mode: "same-origin",
    redirect: "error",
    cache: "no-store",
  });
  const response = await send();
  if (!mutating || response.status !== 403) return response;
  const rejection = await response.clone().json().catch(() => null) as { code?: string } | null;
  if (rejection?.code !== REQUEST_TOKEN_REJECTED) return response;

  // The verification guard runs before side effects and before forwarding to
  // a model. Retry ONLY this explicit pre-dispatch failure, and only once.
  cachedToken = null;
  headers.set(REQUEST_TOKEN_HEADER, await requestToken(init.signal, true));
  return send();
}
