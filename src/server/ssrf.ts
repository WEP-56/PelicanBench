import { lookup } from "node:dns/promises";
import net from "node:net";

const BLOCKED = new Set(["localhost", "localhost.localdomain", "metadata.google.internal", "metadata.internal"]);

function isBenchmarkIp(ip: string) {
  if (net.isIP(ip) !== 4) return false;
  const [a, b] = ip.split(".").map(Number);
  return a === 198 && (b === 18 || b === 19);
}

export function isPrivateIp(ip: string): boolean {
  const kind = net.isIP(ip);
  if (kind === 4) {
    const [a, b] = ip.split(".").map(Number);
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a === 192 && b === 0) return true;
    if (a === 198 && (b === 18 || b === 19)) return true;
    if (a >= 224) return true;
    return false;
  }
  if (kind === 6) {
    const normalized = ip.toLowerCase();
    if (normalized === "::1" || normalized === "::") return true;
    if (normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe80")) return true;
    if (normalized.startsWith("::ffff:")) return isPrivateIp(normalized.slice(7));
    return false;
  }
  return true;
}

export function isPublicDnsResolution(records: { address: string }[], allowDevelopmentBenchmarkMapping: boolean) {
  if (records.length === 0) return false;
  if (allowDevelopmentBenchmarkMapping && records.every((record) => isBenchmarkIp(record.address))) return true;
  return records.every((record) => !isPrivateIp(record.address));
}

export async function assertPublicUrl(raw: string) {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("目标地址无法解析");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("仅允许 http 或 https");
  const host = url.hostname.toLowerCase().replace(/\.+$/, "");
  if (!host || BLOCKED.has(host) || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new Error("该主机不被允许");
  }
  const path = url.pathname.replace(/\/+$/, "") || "/";
  if (!/\/(chat\/completions|responses|messages|models)$/.test(path)) {
    throw new Error("只允许模型列表和生成接口");
  }
  if (net.isIP(host)) {
    if (isPrivateIp(host)) throw new Error("内网地址不被允许");
  } else {
    let records: { address: string }[] = [];
    try {
      records = await lookup(host, { all: true });
    } catch {
      throw new Error("无法解析目标主机");
    }
    // Some local development networks map public hostnames into RFC 2544's
    // 198.18.0.0/15 range and transparently route them through an egress proxy.
    // Permit that mapping only in development and only for hostnames, never IP literals.
    const developmentBenchmarkMapping = process.env.NODE_ENV !== "production";
    if (!isPublicDnsResolution(records, developmentBenchmarkMapping)) {
      throw new Error("目标解析到内网地址，已拒绝");
    }
  }
  return url;
}
