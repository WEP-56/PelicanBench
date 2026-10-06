import { expect, test } from "@playwright/test";
import { assertSameOrigin, HttpError } from "../src/server/http";
import { issueRequestToken, verifyRequestToken } from "../src/server/request-verification";
import { REQUEST_TOKEN_HEADER, REQUEST_TOKEN_PATH, REQUEST_TOKEN_REJECTED } from "../src/lib/request-verification";
import { isPublicDnsResolution } from "../src/server/ssrf";
import { STANDARD_PROMPT } from "../src/lib/constants";

const HTML = '<!DOCTYPE html><html><head><title>测试输出</title></head><body><svg viewBox="0 0 400 200"><circle cx="100" cy="100" r="40" fill="teal"><animate attributeName="cx" values="100;300;100" dur="3s" repeatCount="indefinite"/></circle></svg></body></html>';
const SITE = "https://bench.example";

function requestWith(headers: Record<string, string | undefined> = {}) {
  const requestHeaders = new Headers({ Host: "bench.example", "Content-Type": "application/json" });
  for (const [name, value] of Object.entries(headers)) {
    if (value !== undefined) requestHeaders.set(name, value);
  }
  return new Request(`${SITE}/api/proxy`, { method: "POST", headers: requestHeaders });
}

function denied(request: Request) {
  try { assertSameOrigin(request); } catch (error) { return error; }
  throw new Error("Expected verification rejection");
}

function stripSourceHeaders(headers: Record<string, string>) {
  return Object.fromEntries(Object.entries(headers).filter(([name]) => !["origin", "referer", "sec-fetch-site", "sec-fetch-mode", "sec-fetch-dest"].includes(name.toLowerCase())));
}

test("SSRF policy allows synthetic benchmark DNS only in development and only as a complete resolution", () => {
  const benchmark = [{ address: "198.18.1.160" }];
  expect(isPublicDnsResolution(benchmark, true)).toBe(true);
  expect(isPublicDnsResolution(benchmark, false)).toBe(false);
  expect(isPublicDnsResolution([{ address: "198.18.1.160" }, { address: "93.184.216.34" }], true)).toBe(false);
  expect(isPublicDnsResolution([{ address: "127.0.0.1" }], true)).toBe(false);
  expect(isPublicDnsResolution([{ address: "93.184.216.34" }], false)).toBe(true);
});

test("signed request proofs reject tampering, expiry and admin session token formats", () => {
  const now = Date.now();
  const issued = issueRequestToken(now);
  expect(verifyRequestToken(issued.token, now)).toBe(true);
  expect(verifyRequestToken(issued.token, issued.expiresAt)).toBe(false);
  expect(verifyRequestToken(`${issued.token.slice(0, -1)}!`, now)).toBe(false);
  expect(verifyRequestToken(issued.token.replace("v1.", "v2."), now)).toBe(false);
  expect(verifyRequestToken(`v1.${issued.expiresAt}.fake-admin-signature`, now)).toBe(false);
  expect(verifyRequestToken(null)).toBe(false);
  expect(issued.token).not.toBe(issueRequestToken(now).token);
});

test("origin verification accepts valid browser metadata, same-site Referer and signed fallback", () => {
  const token = issueRequestToken().token;
  for (const headers of [
    { Origin: SITE },
    { Referer: `${SITE}/test?tab=preview` },
    { "Sec-Fetch-Site": "same-origin" },
    { [REQUEST_TOKEN_HEADER]: token },
    { Origin: "null", [REQUEST_TOKEN_HEADER]: token },
  ]) {
    expect(() => assertSameOrigin(requestWith(headers))).not.toThrow();
  }
});

test("origin verification does not fail open or override a foreign source", () => {
  const token = issueRequestToken().token;
  for (const headers of [
    {},
    { Origin: "null" },
    { [REQUEST_TOKEN_HEADER]: "forged-proof" },
    { Origin: "https://attacker.example", [REQUEST_TOKEN_HEADER]: token },
    { Referer: "https://attacker.example/test", [REQUEST_TOKEN_HEADER]: token },
    { Referer: "https://bench.example.attacker.example/test", [REQUEST_TOKEN_HEADER]: token },
    { "Sec-Fetch-Site": "cross-site", Origin: SITE, [REQUEST_TOKEN_HEADER]: token },
    { Origin: "malformed origin", [REQUEST_TOKEN_HEADER]: token },
  ]) {
    const error = denied(requestWith(headers));
    expect(error).toBeInstanceOf(HttpError);
    expect((error as HttpError).status).toBe(403);
  }
  expect((denied(requestWith()) as HttpError).code).toBe(REQUEST_TOKEN_REJECTED);
  expect((denied(requestWith({ Origin: "https://attacker.example" })) as HttpError).code).toBeUndefined();
});

test("explicit APP_URL and forwarded hosts remain enforced", () => {
  expect(() => assertSameOrigin(new Request("http://internal:3000/api/results", {
    method: "POST", headers: { Host: "internal:3000", "X-Forwarded-Host": "bench.example", Referer: `${SITE}/test` },
  }))).not.toThrow();
  const original = process.env.APP_URL;
  try {
    process.env.APP_URL = SITE;
    expect(() => assertSameOrigin(requestWith({ Origin: SITE }))).not.toThrow();
    expect(() => assertSameOrigin(requestWith({ Referer: `${SITE}/test` }))).not.toThrow();
    expect(() => assertSameOrigin(requestWith({ Origin: "http://bench.example" }))).toThrow(HttpError);
  } finally {
    if (original === undefined) delete process.env.APP_URL;
    else process.env.APP_URL = original;
  }
});

test("live APIs accept stripped-header page proof without disabling cross-site protection", async ({ request, baseURL }) => {
  const issuance = await request.get(REQUEST_TOKEN_PATH);
  expect(issuance.status()).toBe(200);
  expect(issuance.headers()["cache-control"]).toContain("no-store");
  expect(issuance.headers()["access-control-allow-origin"]).toBeUndefined();
  const { token } = await issuance.json() as { token: string };
  const headers = { [REQUEST_TOKEN_HEADER]: token };
  // An empty body stops before any model request or database insertion. These
  // 400s prove that the real origin guard accepted the signed request.
  const proxy = await request.post("/api/proxy", { headers, data: {} });
  expect(proxy.status(), await proxy.text()).toBe(400);
  expect((await proxy.json()).error).toBe("只允许 GET 或 POST");
  const publish = await request.post("/api/results", { headers, data: {} });
  expect(publish.status(), await publish.text()).toBe(400);
  expect((await publish.json()).error).toBe("模型名无效");
  const refererOnly = await request.post("/api/proxy", { headers: { Referer: `${baseURL}/test` }, data: {} });
  expect(refererOnly.status(), await refererOnly.text()).toBe(400);
  const noProof = await request.post("/api/proxy", { data: {} });
  expect(noProof.status()).toBe(403);
  expect((await noProof.json()).code).toBe(REQUEST_TOKEN_REJECTED);
  const tampered = await request.post("/api/proxy", { headers: { [REQUEST_TOKEN_HEADER]: "fake" }, data: {} });
  expect(tampered.status()).toBe(403);
  const opaque = await request.post("/api/proxy", { headers: { ...headers, Origin: "null" }, data: {} });
  expect(opaque.status()).toBe(400);
  const foreign = await request.post("/api/proxy", { headers: { ...headers, Origin: "https://attacker.example" }, data: {} });
  expect(foreign.status()).toBe(403);
  const crossSite = await request.post("/api/proxy", { headers: { ...headers, "Sec-Fetch-Site": "cross-site" }, data: {} });
  expect(crossSite.status()).toBe(403);
  const foreignTokenRead = await request.get(REQUEST_TOKEN_PATH, { headers: { "Sec-Fetch-Site": "cross-site" } });
  expect(foreignTokenRead.status()).toBe(403);
});

test("proxy explains blocked target URLs instead of returning a generic network error", async ({ request, baseURL }) => {
  const origin = new URL(baseURL || "http://127.0.0.1:3000").origin;
  const response = await request.post("/api/proxy", {
    headers: { Origin: origin },
    data: { url: "http://127.0.0.1/v1/models", method: "GET", headers: {} },
  });
  expect(response.status(), await response.text()).toBe(400);
  expect((await response.json()).error).toContain("内网地址不被允许");
});

test("model listing and generation recover from stripped headers and refresh a stale token once", async ({ page }) => {
  await page.route("https://fonts.googleapis.com/**", (route) => route.abort());
  await page.route("https://fonts.gstatic.com/**", (route) => route.abort());
  const providerProofs: (string | undefined)[] = [];
  const forwardedProofs: (string | undefined)[] = [];
  const guardStatuses: number[] = [];
  const guardMessages: string[] = [];
  let tokenReads = 0;
  await page.route("https://upstream.invalid/**", async (route) => {
    providerProofs.push(route.request().headers()[REQUEST_TOKEN_HEADER]);
    await route.abort("failed"); // Simulate a provider that does not support CORS.
  });
  await page.route(`**${REQUEST_TOKEN_PATH}`, async (route) => {
    tokenReads += 1;
    const response = await route.fetch();
    if (tokenReads !== 1) { await route.fulfill({ response }); return; }
    const data = await response.json();
    // Shape-valid but invalid signature, simulating a server restart.
    data.token = `${data.token.slice(0, -1)}!`;
    await route.fulfill({ response, json: data });
  });
  await page.route("**/api/proxy", async (route) => {
    const incoming = route.request().postDataJSON() as { url: string; method: string; headers: Record<string, string> };
    forwardedProofs.push(incoming.headers[REQUEST_TOKEN_HEADER]);
    // Use the real backend verification but stop before the paid upstream.
    const checked = await route.fetch({ headers: stripSourceHeaders(route.request().headers()), postData: "{}" });
    guardStatuses.push(checked.status());
    guardMessages.push((await checked.json()).error);
    if (checked.status() !== 400) { await route.fulfill({ response: checked }); return; }
    const body = incoming.url.endsWith("/models")
      ? { data: [{ id: "regression-pelican" }] }
      : { choices: [{ message: { content: HTML } }], usage: { prompt_tokens: 11, completion_tokens: 22, total_tokens: 33 } };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: 200, body: JSON.stringify(body) }) });
  });
  await page.goto("/test");
  await page.getByLabel("Base URL", { exact: true }).fill("https://upstream.invalid/v1");
  await page.getByLabel("API Key", { exact: true }).fill("regression-not-a-real-key");
  await page.getByRole("button", { name: "获取模型", exact: true }).click();
  const models = page.getByRole("dialog", { name: "选择模型", exact: true });
  await expect(models).toBeVisible();
  await models.getByRole("button", { name: "regression-pelican", exact: true }).click();
  await page.getByRole("button", { name: "开始生成", exact: true }).click();
  await expect(page.locator('iframe[title="本次生成的鹈鹕动画"]')).toBeVisible();
  expect(guardStatuses).toEqual([403, 400, 400]);
  expect(guardMessages.slice(1)).toEqual(["只允许 GET 或 POST", "只允许 GET 或 POST"]);
  expect(tokenReads).toBe(2);
  expect(providerProofs.length).toBeGreaterThanOrEqual(2);
  expect(providerProofs.every((token) => token === undefined)).toBe(true);
  expect(forwardedProofs.every((token) => token === undefined)).toBe(true);
  await expect(page.locator(".stage .banner-error")).toHaveCount(0);
});

test("upload client also supplies a signed proof without Origin, Referer or Fetch Metadata", async ({ page }) => {
  await page.route("https://fonts.googleapis.com/**", (route) => route.abort());
  await page.route("https://fonts.gstatic.com/**", (route) => route.abort());
  await page.addInitScript(({ html, prompt }) => {
    localStorage.setItem("pb-history", JSON.stringify([{
      id: "source-header-regression", createdAt: new Date().toISOString(), model: "source-header-regression",
      protocol: "openai-chat", thinkingLevel: "medium", baseUrl: "https://api.openai.com/v1", channelPref: "official",
      inputTokens: 11, outputTokens: 22, totalTokens: 33, durationMs: 200, html, rawPreview: "", prompt,
      ok: true, via: "direct", fromFence: false, endpoint: "https://api.openai.com/v1/chat/completions",
    }]));
  }, { html: HTML, prompt: STANDARD_PROMPT });
  let guardStatus: number | undefined;
  let hasProof = false;
  await page.route("**/api/results", async (route) => {
    hasProof = Boolean(route.request().headers()[REQUEST_TOKEN_HEADER]);
    const checked = await route.fetch({ headers: stripSourceHeaders(route.request().headers()), postData: "{}" });
    guardStatus = checked.status();
    if (checked.status() !== 400) { await route.fulfill({ response: checked }); return; }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: "not-persisted-regression" }) });
  });
  await page.goto("/history");
  await page.getByRole("button", { name: /source-header-regression/ }).click();
  const dialog = page.getByRole("dialog", { name: "source-header-regression", exact: true });
  await dialog.getByRole("switch", { name: "公示这条结果", exact: true }).click();
  await dialog.getByRole("button", { name: "确认公示", exact: true }).click();
  await expect(dialog.getByRole("link", { name: "查看公示", exact: true })).toHaveAttribute("href", "/gallery/not-persisted-regression");
  expect(hasProof).toBe(true);
  expect(guardStatus).toBe(400);
});
