import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { RequestToken } from "@/lib/request-verification";

const TOKEN_LIFETIME_MS = 30 * 60 * 1000;
const PURPOSE = "pelicanbench:first-party-request:";

const processState = globalThis as typeof globalThis & { __pelicanbenchRequestSecret?: string };

function signingSecret() {
  const configured = process.env.CSRF_SECRET || process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD;
  if (configured) return configured;
  // Single-instance previews need no extra configuration. A multi-instance
  // deployment should set the same CSRF_SECRET on each instance.
  processState.__pelicanbenchRequestSecret ??= randomBytes(32).toString("hex");
  return processState.__pelicanbenchRequestSecret;
}

function signature(payload: string) {
  return createHmac("sha256", signingSecret()).update(PURPOSE + payload).digest("base64url");
}

export function issueRequestToken(now = Date.now()): RequestToken {
  const expiresAt = now + TOKEN_LIFETIME_MS;
  const nonce = randomBytes(24).toString("base64url");
  const payload = `v1.${expiresAt}.${nonce}`;
  return { token: `${payload}.${signature(payload)}`, expiresAt };
}

export function verifyRequestToken(token: string | null | undefined, now = Date.now()) {
  if (!token || token.length > 256) return false;
  const match = /^v1\.(\d{13})\.([A-Za-z0-9_-]{32})\.([A-Za-z0-9_-]{43})$/.exec(token);
  if (!match) return false;
  const expiresAt = Number(match[1]);
  if (expiresAt <= now || expiresAt > now + TOKEN_LIFETIME_MS + 30_000) return false;
  const payload = `v1.${match[1]}.${match[2]}`;
  const expected = Buffer.from(signature(payload));
  const provided = Buffer.from(match[3]);
  return expected.length === provided.length && timingSafeEqual(expected, provided);
}
