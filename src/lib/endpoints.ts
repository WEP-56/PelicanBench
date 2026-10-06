import { DEFAULT_BASE, OFFICIAL_HOSTS, type Protocol, protocolOf } from "./constants";

export function resolveBase(input: string, autoV1: boolean): { href: string } | { error: string } {
  const raw = input.trim();
  if (!raw) return { error: "请填写 Base URL" };
  const withProto = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  let url: URL;
  try {
    url = new URL(withProto);
  } catch {
    return { error: "Base URL 无法解析" };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return { error: "仅支持 http 或 https" };
  url.username = "";
  url.password = "";
  url.search = "";
  url.hash = "";
  let path = url.pathname.replace(/\/+$/, "");
  path = path.replace(/\/(chat\/completions|responses|messages|models)$/, "");
  path = path.replace(/\/+$/, "");
  if (autoV1 && !path.endsWith("/v1")) path = `${path}/v1`;
  if (!path) path = autoV1 ? "/v1" : "";
  url.pathname = path || "/";
  return { href: url.toString().replace(/\/+$/, "") };
}

export function hostnameOnly(input: string | null | undefined): string | null {
  if (!input?.trim()) return null;
  try {
    const raw = input.trim();
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    return url.hostname || null;
  } catch {
    return null;
  }
}

export function buildEndpoint(
  base: string,
  protocol: Protocol,
  autoV1: boolean,
  kind: "generate" | "models" = "generate",
) {
  const resolved = resolveBase(base, autoV1);
  if ("error" in resolved) return resolved;
  const path = kind === "models" ? "/models" : protocolOf(protocol)?.path ?? "/chat/completions";
  return { href: `${resolved.href}${path}` };
}

export function isOfficialHost(base: string, autoV1 = true) {
  const resolved = resolveBase(base, autoV1);
  if ("error" in resolved) return false;
  try {
    return OFFICIAL_HOSTS.includes(new URL(resolved.href).hostname);
  } catch {
    return false;
  }
}

export function isDefaultBase(value: string) {
  const cleaned = value.trim().replace(/\/+$/, "");
  return Object.values(DEFAULT_BASE).some((item) => item === cleaned);
}
