import type { Protocol } from "./constants";

export type HeaderEntry = {
  id: string;
  name: string;
  value: string;
  enabled: boolean;
};
export type HeaderSettings = {
  preset: string;
  entries: HeaderEntry[];
  transport: "auto" | "proxy";
};
export const EMPTY_HEADER_SETTINGS: HeaderSettings = { preset: "default", entries: [], transport: "auto" };
export const MAX_CUSTOM_HEADERS = 24;
const MAX_FORWARDED_HEADERS = 32;
const MAX_VALUE_LENGTH = 4096;
const MAX_TOTAL_LENGTH = 16_384;
const NAME = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;
const VALUE = /^[\t\x20-\x7e]*$/;

const BLOCKED = new Set([
  "host", "cookie", "cookie2", "set-cookie", "connection", "content-length", "transfer-encoding",
  "te", "trailer", "upgrade", "keep-alive", "expect", "accept-encoding", "accept-charset",
  "origin", "referer", "referrer", "forwarded", "via", "date", "dnt", "permissions-policy",
  "x-real-ip", "x-client-ip", "client-ip", "true-client-ip", "cf-connecting-ip", "cf-connecting-ipv6",
  "x-original-url", "x-rewrite-url", "x-http-method", "x-http-method-override", "x-method-override",
]);
const MANAGED = new Set(["content-type", "accept", "anthropic-dangerous-direct-browser-access"]);

export class HeaderConfigError extends Error {
  constructor(message: string) { super(message); this.name = "HeaderConfigError"; }
}

export function headerIssue(name: string, value: string, custom = true): string | null {
  if (!name || name.length > 128 || !NAME.test(name)) return "头名称只能使用 HTTP 字段名字符，不能包含空格、冒号或换行";
  const lower = name.toLowerCase();
  if (BLOCKED.has(lower) || /^(?:sec-|proxy-|x-forwarded-|x-pelicanbench-|access-control-)/i.test(lower)) {
    return `${name} 由浏览器、连接或本站安全校验管理，不能自定义转发`;
  }
  if (custom && MANAGED.has(lower)) return `${name} 由当前协议自动生成，不能覆盖`;
  if (value.length > MAX_VALUE_LENGTH) return `${name} 的值不能超过 ${MAX_VALUE_LENGTH} 个字符`;
  if (!VALUE.test(value)) return `${name} 的值只能包含可打印 ASCII 字符，不能包含换行、中文或控制字符`;
  if (!value.trim()) return `${name} 的值不能为空；不需要发送时请停用这一项`;
  if (custom && /\{\{[^}]*\}\}/.test(value.replaceAll("{{API_KEY}}", ""))) return "仅支持 {{API_KEY}} 占位符";
  return null;
}

function populated(entries: HeaderEntry[]) {
  return entries.filter((entry) => entry.enabled && (entry.name.trim() || entry.value.trim()));
}

export function inspectHeaders(entries: HeaderEntry[]) {
  const errors: { id: string; message: string }[] = [];
  const active = populated(entries);
  const seen = new Set<string>();
  let total = 0;
  for (const entry of active) {
    // Validate the raw field name and value before trimming, so CRLF isn't hidden.
    const rawIssue = /[\r\n\0]/.test(entry.name) ? "头名称不能包含换行或控制字符" : null;
    const name = entry.name.trim();
    const issue = rawIssue || headerIssue(name, entry.value);
    if (issue) errors.push({ id: entry.id, message: issue });
    const lower = name.toLowerCase();
    if (seen.has(lower)) errors.push({ id: entry.id, message: `${name} 重复（名称不区分大小写），请合并或停用其中一项` });
    seen.add(lower);
    total += name.length + entry.value.length;
  }
  if (active.length > MAX_CUSTOM_HEADERS) errors.push({ id: "limit", message: `最多启用 ${MAX_CUSTOM_HEADERS} 个自定义头` });
  if (total > MAX_TOTAL_LENGTH) errors.push({ id: "limit", message: "自定义头总长度不能超过 16KB" });
  return { errors, active, needsProxy: active.some((entry) => entry.name.trim().toLowerCase() === "user-agent") };
}

export function assertHeaderTransport(settings?: HeaderSettings) {
  const checked = inspectHeaders(settings?.entries ?? []);
  if (checked.errors.length) throw new HeaderConfigError(checked.errors[0].message);
  if (checked.needsProxy && settings?.transport !== "proxy") {
    throw new HeaderConfigError("User-Agent 在浏览器中不能可靠设置。请启用「始终通过本站一次性中转」，或停用该头后重试。");
  }
}

/** Protocol defaults first, then explicit enabled overrides, case-insensitively. */
export function buildRequestHeaders(protocol: Protocol, apiKey: string, direct: boolean, entries: HeaderEntry[] = []) {
  const checked = inspectHeaders(entries);
  if (checked.errors.length) throw new HeaderConfigError(checked.errors[0].message);
  const headers = new Headers({ "Content-Type": "application/json", Accept: "application/json" });
  if (protocol === "anthropic") {
    headers.set("x-api-key", apiKey);
    headers.set("anthropic-version", "2023-06-01");
    if (direct) headers.set("anthropic-dangerous-direct-browser-access", "true");
  } else {
    headers.set("Authorization", `Bearer ${apiKey}`);
  }
  for (const entry of checked.active) {
    const name = entry.name.trim();
    const value = entry.value.replaceAll("{{API_KEY}}", apiKey);
    const issue = headerIssue(name, value);
    if (issue) throw new HeaderConfigError(issue);
    headers.set(name, value.trim());
  }
  return Object.fromEntries(headers.entries());
}

/** Validate, don't silently drop, user-supplied upstream fields at the proxy. */
export function validateForwardHeaders(input: unknown): Headers {
  if (input == null) return new Headers();
  if (typeof input !== "object" || Array.isArray(input)) throw new HeaderConfigError("请求头必须是名称到字符串值的对象");
  const entries = Object.entries(input);
  if (entries.length > MAX_FORWARDED_HEADERS) throw new HeaderConfigError("转发请求头不能超过 32 项");
  const output = new Headers();
  const seen = new Set<string>();
  let total = 0;
  for (const [name, value] of entries) {
    if (typeof value !== "string") throw new HeaderConfigError("请求头的值必须是字符串");
    const issue = headerIssue(name, value, false);
    if (issue) throw new HeaderConfigError(issue);
    const lower = name.toLowerCase();
    if (seen.has(lower)) throw new HeaderConfigError(`${name} 重复（名称不区分大小写）`);
    seen.add(lower);
    total += name.length + value.length;
    if (total > MAX_TOTAL_LENGTH) throw new HeaderConfigError("转发请求头总长度不能超过 16KB");
    if (lower === "content-type" && !/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(value.trim())) {
      throw new HeaderConfigError("本站生成接口只支持 application/json 请求体");
    }
    output.set(name, value.trim());
  }
  return output;
}

export function headerIsSensitive(name: string) {
  return /authorization|api[-_]?key|token|secret|password|credential|cookie/i.test(name);
}

// Unknown custom values are also hidden in previews; the editor is the only
// place to view them. Never serialize this configuration into history/uploads.
const VISIBLE_PREVIEW = new Set(["accept", "content-type", "user-agent", "originator", "x-app", "anthropic-version", "anthropic-beta", "anthropic-dangerous-direct-browser-access"]);
export function headerPreview(protocol: Protocol, settings: HeaderSettings) {
  const values = buildRequestHeaders(protocol, "__PEL_KEY_REDACTED__", settings.transport !== "proxy", settings.entries);
  return Object.fromEntries(Object.entries(values).map(([name, value]) => [
    name,
    headerIsSensitive(name) || value.includes("__PEL_KEY_REDACTED__") || !VISIBLE_PREVIEW.has(name)
      ? "••••（已隐藏）"
      : value,
  ]));
}

/** Avoid persisting a credential if an upstream error echoes it. */
export function redactRequestError(text: string, apiKey: string, settings?: HeaderSettings) {
  const secrets = [apiKey.trim(), ...populated(settings?.entries ?? [])
    .filter((entry) => headerIsSensitive(entry.name))
    .map((entry) => entry.value.replaceAll("{{API_KEY}}", apiKey).trim())]
    .filter((value) => value.length >= 4)
    .sort((left, right) => right.length - left.length);
  for (const secret of new Set(secrets)) text = text.split(secret).join("[已隐藏]");
  return text;
}
