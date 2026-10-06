import { siteFetch, SiteRequestError } from "./site-fetch";

export class ApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "ApiError";
  }
}

export async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Accept", "application/json");
  if (init?.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  let response: Response;
  try {
    response = await siteFetch(url, {
      ...init,
      headers,
      signal: init?.signal ?? AbortSignal.timeout(25_000),
    });
  } catch (error) {
    if (error instanceof SiteRequestError) throw new ApiError(error.message, error.status);
    const timedOut = error instanceof DOMException && ["AbortError", "TimeoutError"].includes(error.name);
    throw new ApiError(timedOut ? "本站后端请求超时，请稍后重试" : "无法连接本站后端，请检查网络后重试", 0);
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    const missing = response.status === 404 || response.status === 405;
    throw new ApiError(
      missing
        ? "未找到本站后端接口。管理与上传需要运行 Next.js 服务和 PostgreSQL，不能只部署静态页面。"
        : "本站后端没有返回有效数据，请稍后重试。",
      response.status,
    );
  }
  if (!response.ok) {
    const error = data && typeof data === "object" && "error" in data ? (data as { error?: unknown }).error : null;
    throw new ApiError(typeof error === "string" ? error : `本站后端请求失败（${response.status}）`, response.status);
  }
  return data as T;
}
