import { createHmac, timingSafeEqual } from "node:crypto";
import { HttpError } from "./http";

const COOKIE = "pb_admin";

function secret() {
  return process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD || "";
}

export function passwordsMatch(input: string, expected: string) {
  const left = Buffer.from(input);
  const right = Buffer.from(expected);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function createSessionToken() {
  const key = secret();
  if (!key) throw new HttpError(500, "尚未配置 ADMIN_PASSWORD");
  const exp = Date.now() + 12 * 60 * 60 * 1000;
  const payload = `v1.${exp}`;
  const sig = createHmac("sha256", key).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifySessionToken(token: string | undefined) {
  const key = secret();
  if (!token || !key) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [ver, exp, sig] = parts;
  if (ver !== "v1") return false;
  const expected = createHmac("sha256", key).update(`${ver}.${exp}`).digest("base64url");
  const left = Buffer.from(sig);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return false;
  const expires = Number(exp);
  return Number.isFinite(expires) && expires > Date.now();
}

export function readCookie(req: Request, name = COOKIE) {
  const raw = req.headers.get("cookie") || "";
  for (const part of raw.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return undefined;
}

export function isAdmin(req: Request) {
  return verifySessionToken(readCookie(req));
}

export function requireAdmin(req: Request) {
  if (!isAdmin(req)) throw new HttpError(401, "需要管理口令");
}

export function sessionCookie(token: string, req: Request) {
  const forwardedProto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const secure = forwardedProto ? forwardedProto === "https" : new URL(req.url).protocol === "https:";
  const parts = [`${COOKIE}=${token}`, "HttpOnly", "Path=/", "SameSite=Lax", "Max-Age=43200"];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function clearSessionCookie() {
  return `${COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`;
}
