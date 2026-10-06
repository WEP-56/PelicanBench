import { expect, test, type Page } from "@playwright/test";
import { STANDARD_PROMPT } from "../src/lib/constants";
import { HEADER_PRESETS, presetEntries } from "../src/lib/header-presets";
import { buildAuthHeaders, buildPayload, runBench } from "../src/lib/llm-client";
import { assertHeaderTransport, buildRequestHeaders, headerPreview, inspectHeaders, redactRequestError, validateForwardHeaders, type HeaderEntry, type HeaderSettings } from "../src/lib/request-headers";
import { REQUEST_TOKEN_HEADER } from "../src/lib/request-verification";

const HTML = '<!DOCTYPE html><html><body><svg viewBox="0 0 300 200"><circle cx="80" cy="90" r="30" fill="teal"><animate attributeName="cx" values="80;220;80" dur="2s" repeatCount="indefinite"/></circle></svg></body></html>';
function row(name: string, value: string, enabled = true): HeaderEntry { return { id: name, name, value, enabled }; }
function settings(entries: HeaderEntry[], transport: "auto" | "proxy" = "auto"): HeaderSettings { return { preset: "custom", entries, transport }; }

async function prepare(page: Page) {
  await page.route("https://fonts.googleapis.com/**", (route) => route.abort());
  await page.route("https://fonts.gstatic.com/**", (route) => route.abort());
  await page.goto("/test");
  await page.getByLabel("Base URL", { exact: true }).fill("https://headers-test.invalid/v1");
  await page.getByLabel("API Key", { exact: true }).fill("not-a-real-api-key");
  await page.locator(".header-config > summary").click();
}

function jsonModelReply() {
  return { choices: [{ message: { content: HTML } }], usage: { prompt_tokens: 11, completion_tokens: 22, total_tokens: 33 } };
}

test("presets are pinned, minimal and do not invent OAuth or session identifiers", () => {
  const codex = buildAuthHeaders("openai-responses", "key", false, presetEntries("codex"));
  expect(codex.originator).toBe("codex_cli_rs");
  expect(codex["user-agent"]).toBe("codex_cli_rs/0.160.1");
  const opencode = buildAuthHeaders("openai-chat", "key", false, presetEntries("opencode"));
  expect(opencode["user-agent"]).toBe("opencode/1.18.34");
  const claude = buildAuthHeaders("anthropic", "key", false, presetEntries("claude-code"));
  expect(claude["user-agent"]).toBe("claude-cli/2.1.63 (external, cli)");
  expect(claude["x-app"]).toBe("cli");
  expect(claude["anthropic-version"]).toBe("2023-06-01");
  expect(claude).not.toHaveProperty("anthropic-beta");
  expect(claude).not.toHaveProperty("anthropic-dangerous-direct-browser-access");
  expect(JSON.stringify([codex, opencode, claude])).not.toContain("session-id");
  for (const preset of HEADER_PRESETS.filter((p) => p.id !== "default")) {
    expect(preset.sources.length).toBeGreaterThan(0);
    expect(inspectHeaders(presetEntries(preset.id)).errors).toEqual([]);
    expect(inspectHeaders(presetEntries(preset.id)).needsProxy).toBe(true);
  }
});

test("enabled overrides replace protocol defaults case-insensitively and expand API_KEY", () => {
  const entries = [row("aUtHoRiZaTiOn", "Custom {{API_KEY}}"), row("X-Relay", "my-gateway"), row("X-Ignore", "never-send", false)];
  const headers = buildRequestHeaders("openai-chat", "private-key", true, entries);
  expect(headers.authorization).toBe("Custom private-key");
  expect(Object.keys(headers).filter((name) => name.toLowerCase() === "authorization")).toHaveLength(1);
  expect(headers["x-relay"]).toBe("my-gateway");
  expect(headers).not.toHaveProperty("x-ignore");
  expect(headers["content-type"]).toBe("application/json");
  const claude = buildRequestHeaders("anthropic", "private-key", true, [row("anthropic-beta", "user-supplied-capability")]);
  expect(claude["x-api-key"]).toBe("private-key");
  expect(claude["anthropic-dangerous-direct-browser-access"]).toBe("true");
  expect(claude["anthropic-beta"]).toBe("user-supplied-capability");
});

test("unsafe, duplicated and oversized headers are rejected before transmission", () => {
  const blocked = ["Host", "Cookie", "Origin", "Referer", "Content-Length", "Transfer-Encoding", "Connection", "Proxy-Authorization", "Sec-Fetch-Site", "X-Forwarded-For", "X-Real-IP", REQUEST_TOKEN_HEADER];
  for (const name of blocked) {
    expect(inspectHeaders([row(name, "unsafe-value")]).errors.length).toBeGreaterThan(0);
    expect(() => validateForwardHeaders({ [name]: "unsafe-value" })).toThrow();
  }
  for (const name of ["Content-Type", "Accept", "anthropic-dangerous-direct-browser-access"]) {
    expect(inspectHeaders([row(name, "custom")]).errors.length).toBeGreaterThan(0);
  }
  expect(inspectHeaders([row("X-Test", "one"), { ...row("x-test", "two"), id: "2" }]).errors[0].message).toContain("重复");
  expect(() => validateForwardHeaders({ "X-Test": "one", "x-test": "two" })).toThrow(/重复/);
  expect(inspectHeaders([row("X-Test", "line1\r\nX-Other: injected")]).errors[0].message).toContain("控制字符");
  expect(() => validateForwardHeaders({ "X-Test": "bad\r\nheader" })).toThrow();
  expect(inspectHeaders([row("Bad Name", "value")]).errors.length).toBeGreaterThan(0);
  expect(inspectHeaders([row("X-Test", "x".repeat(4097))]).errors.length).toBeGreaterThan(0);
  expect(inspectHeaders(Array.from({ length: 25 }, (_, i) => row(`X-${i}`, "value"))).errors.length).toBeGreaterThan(0);
  expect(() => validateForwardHeaders({ "X-Test": 12 })).toThrow();
  expect(() => validateForwardHeaders([])).toThrow();
  expect(() => validateForwardHeaders({ "Content-Type": "text/plain" })).toThrow();
  expect(inspectHeaders([row("X-Test", "{{UNKNOWN}}")]).errors[0].message).toContain("API_KEY");
  expect(inspectHeaders([row("Host", "unsafe", false)]).errors).toEqual([]);
});

test("UA requires explicit proxy consent and sensitive header previews are always masked", () => {
  const entries = [row("User-Agent", "opencode/1.18.34"), row("Authorization", "Bearer {{API_KEY}}"), row("X-Unclassified", "unknown-private-value")];
  expect(() => assertHeaderTransport(settings(entries))).toThrow(/一次性中转/);
  expect(() => assertHeaderTransport(settings(entries, "proxy"))).not.toThrow();
  const preview = headerPreview("openai-chat", settings(entries, "proxy"));
  expect(preview["user-agent"]).toBe("opencode/1.18.34");
  expect(preview.authorization).toContain("隐藏");
  expect(preview["x-unclassified"]).toContain("隐藏");
  expect(JSON.stringify(preview)).not.toContain("unknown-private-value");
  expect(redactRequestError("Failed Bearer secret-key with custom-token", "secret-key", settings([row("X-Relay-Token", "custom-token")]))).not.toContain("custom-token");
});

test("forwarding policy preserves all accepted custom fields instead of silently dropping them", () => {
  const source = { "User-Agent": "opencode/1.18.34", originator: "codex_cli_rs", "x-app": "cli", "anthropic-beta": "optional-capability", "X-Custom-Relay-Key": "temporary-key", Authorization: "Bearer value" };
  const headers = validateForwardHeaders(source);
  for (const [name, value] of Object.entries(source)) expect(headers.get(name)).toBe(value);
  expect(headers.has(REQUEST_TOKEN_HEADER)).toBe(false);
});

test("header changes leave benchmark prompts and all three protocol bodies intact", () => {
  const chat = buildPayload("openai-chat", "m", "medium");
  expect(chat.messages).toEqual([{ role: "user", content: STANDARD_PROMPT }]);
  expect(chat.reasoning_effort).toBe("medium");
  const responses = buildPayload("openai-responses", "m", "high");
  expect(responses.input).toBe(STANDARD_PROMPT);
  expect(responses.reasoning).toEqual({ effort: "high" });
  const claude = buildPayload("anthropic", "m", "low");
  expect(claude.messages).toEqual([{ role: "user", content: STANDARD_PROMPT }]);
  expect(claude.thinking).toEqual({ type: "enabled", budget_tokens: 1024 });
});

test("invalid UA transport returns an actionable result without a request", async () => {
  const result = await runBench({ baseUrl: "https://never-called.invalid/v1", apiKey: "fake-key", protocol: "openai-chat", model: "m", thinking: "off", autoV1: true, allowProxy: true, headerSettings: settings(presetEntries("codex")) });
  expect(result.ok).toBe(false);
  expect(result.error).toContain("User-Agent");
  expect(result.error).toContain("一次性中转");
});

test("server rejects forbidden forwarded headers even when a client bypasses UI validation", async ({ request, baseURL }) => {
  const headers = { Origin: new URL(baseURL || "http://127.0.0.1:3000").origin, "X-Forwarded-For": "192.0.2.121" };
  for (const unsafe of ["Host", "Cookie", "Connection", "X-Forwarded-Host", REQUEST_TOKEN_HEADER]) {
    const response = await request.post("/api/proxy", {
      headers,
      data: { url: "https://never-called.invalid/v1/models", method: "GET", headers: { [unsafe]: "do-not-record-this-value" } },
    });
    expect(response.status(), await response.text()).toBe(400);
    expect(await response.text()).not.toContain("do-not-record-this-value");
  }
});

test("Codex preset needs consent, then sends custom headers on both models and generation", async ({ page }) => {
  await prepare(page);
  const panel = page.locator(".header-config");
  await panel.getByRole("button", { name: /^Codex CLI/ }).click();
  await expect(panel.getByLabel("头名称 1", { exact: true })).toHaveValue("originator");
  await expect(panel.getByLabel("头值 2", { exact: true })).toHaveValue("codex_cli_rs/0.160.1");
  await expect(page.getByRole("button", { name: "获取模型", exact: true })).toBeDisabled();
  await expect(panel.getByRole("switch", { name: "始终通过本站一次性中转", exact: true })).toHaveAttribute("aria-checked", "false");
  await panel.getByRole("button", { name: "同意并启用一次性中转", exact: true }).click();
  await panel.getByRole("button", { name: "添加请求头", exact: true }).click();
  await panel.getByLabel("头名称 3", { exact: true }).fill("X-Relay-Token");
  await panel.getByLabel("头值 3", { exact: true }).fill("private-header-value");
  await expect(panel.getByLabel("头值 3", { exact: true })).toHaveAttribute("type", "password");
  await panel.locator(".header-effective summary").click();
  await expect(panel.locator(".header-effective pre")).not.toContainText("private-header-value");
  await expect(panel.locator(".header-effective pre")).toContainText("codex_cli_rs/0.160.1");

  let directCalls = 0;
  const calls: { method: string; headers: Record<string, string>; body: unknown }[] = [];
  const ownHeaders: Record<string, string>[] = [];
  await page.route("https://headers-test.invalid/**", async (route) => { directCalls += 1; await route.abort(); });
  await page.route("**/api/proxy", async (route) => {
    const call = route.request().postDataJSON();
    calls.push(call);
    ownHeaders.push(route.request().headers());
    const response = call.method === "GET" ? { data: [{ id: "headers-model" }] } : jsonModelReply();
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: 200, body: JSON.stringify(response) }) });
  });
  await page.getByRole("button", { name: "获取模型", exact: true }).click();
  const models = page.getByRole("dialog", { name: "选择模型", exact: true });
  await expect(models).toBeVisible();
  await models.getByRole("button", { name: "headers-model", exact: true }).click();
  await page.getByRole("button", { name: "开始生成", exact: true }).click();
  await expect(page.locator('iframe[title="本次生成的鹈鹕动画"]')).toBeVisible();
  expect(directCalls).toBe(0);
  expect(calls.map((call) => call.method)).toEqual(["GET", "POST"]);
  for (const call of calls) {
    expect(call.headers["user-agent"]).toBe("codex_cli_rs/0.160.1");
    expect(call.headers.originator).toBe("codex_cli_rs");
    expect(call.headers["x-relay-token"]).toBe("private-header-value");
    expect(call.headers.authorization).toBe("Bearer not-a-real-api-key");
    expect(call.headers).not.toHaveProperty(REQUEST_TOKEN_HEADER);
  }
  for (const header of ownHeaders) {
    expect(header).not.toHaveProperty("x-relay-token");
    expect(header).not.toHaveProperty("authorization");
    expect(header[REQUEST_TOKEN_HEADER]).toBeTruthy();
  }
  expect(calls[1].body).toMatchObject({ messages: [{ role: "user", content: STANDARD_PROMPT }] });
  const stores = await page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }));
  expect(stores).not.toContain("private-header-value");
  expect(stores).not.toContain("codex_cli_rs");
  await page.reload();
  await expect(page.locator(".header-config-summary")).toContainText("标准 API · 0 项额外头 · 浏览器优先");
});

test("JSON import validates errors and edits, disables, removes and resets rows", async ({ page }) => {
  await prepare(page);
  const panel = page.locator(".header-config");
  await panel.getByRole("button", { name: "导入 JSON", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "导入请求头 JSON", exact: true });
  await dialog.getByLabel("请求头 JSON", { exact: true }).fill('{"Host":"blocked.example"}');
  await dialog.getByRole("button", { name: "替换为导入内容", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("不能自定义");
  await dialog.getByLabel("请求头 JSON", { exact: true }).fill('{"X-Relay-Region":"east","Authorization":"Bearer {{API_KEY}}"}');
  await dialog.getByRole("button", { name: "替换为导入内容", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await panel.getByLabel("头名称 2", { exact: true }).fill("x-relay-region");
  await expect(panel.getByRole("alert")).toContainText("重复");
  await panel.getByLabel("启用请求头 2", { exact: true }).uncheck();
  await expect(panel.getByRole("alert")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "获取模型", exact: true })).toBeEnabled();
  await panel.getByRole("button", { name: "删除请求头 2", exact: true }).click();
  await expect(panel.locator(".header-entry")).toHaveCount(1);
  await panel.getByRole("button", { name: "恢复默认请求头", exact: true }).click();
  await expect(panel.locator(".header-entry")).toHaveCount(0);
  await expect(panel.getByRole("switch", { name: "始终通过本站一次性中转", exact: true })).toHaveAttribute("aria-checked", "false");
});

test("browser-safe custom fields work on direct requests without contacting the proxy", async ({ page }) => {
  await prepare(page);
  const panel = page.locator(".header-config");
  await panel.getByRole("button", { name: "添加请求头", exact: true }).click();
  await panel.getByLabel("头名称 1", { exact: true }).fill("X-Relay-Region");
  await panel.getByLabel("头值 1", { exact: true }).fill("east");
  const directHeaders: Record<string, string>[] = [];
  let proxyCalls = 0;
  await page.route("**/api/proxy", async (route) => { proxyCalls += 1; await route.abort(); });
  await page.route("https://headers-test.invalid/**", async (route) => {
    directHeaders.push(route.request().headers());
    const response = route.request().url().endsWith("/models") ? { data: [{ id: "direct-header-model" }] } : jsonModelReply();
    await route.fulfill({ status: 200, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify(response) });
  });
  await page.getByRole("button", { name: "获取模型", exact: true }).click();
  await page.getByRole("dialog", { name: "选择模型", exact: true }).getByRole("button", { name: "direct-header-model", exact: true }).click();
  await page.getByRole("button", { name: "开始生成", exact: true }).click();
  await expect(page.locator('iframe[title="本次生成的鹈鹕动画"]')).toBeVisible();
  expect(proxyCalls).toBe(0);
  expect(directHeaders).toHaveLength(2);
  for (const header of directHeaders) {
    expect(header["x-relay-region"]).toBe("east");
    expect(header[REQUEST_TOKEN_HEADER]).toBeUndefined();
  }
});

test("CORS fallback keeps headers and does not turn an HTTP denial into extra model calls", async ({ page }) => {
  await prepare(page);
  const panel = page.locator(".header-config");
  await panel.getByRole("button", { name: "添加请求头", exact: true }).click();
  await panel.getByLabel("头名称 1", { exact: true }).fill("X-Relay-Region");
  await panel.getByLabel("头值 1", { exact: true }).fill("east");
  let proxyCalls = 0;
  await page.route("https://headers-test.invalid/**", (route) => route.abort("failed"));
  await page.route("**/api/proxy", async (route) => {
    proxyCalls += 1;
    expect(route.request().postDataJSON().headers["x-relay-region"]).toBe("east");
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: 200, body: JSON.stringify({ data: [{ id: "fallback-model" }] }) }) });
  });
  await page.getByRole("button", { name: "获取模型", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "选择模型", exact: true })).toBeVisible();
  await page.getByRole("dialog", { name: "选择模型", exact: true }).getByRole("button", { name: "关闭", exact: true }).click();
  expect(proxyCalls).toBe(1);
  await page.unroute("https://headers-test.invalid/**");
  await page.route("https://headers-test.invalid/**", (route) => route.fulfill({ status: 403, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ error: { message: "gateway-client-policy-denied" } }) }));
  await page.getByRole("button", { name: "获取模型", exact: true }).click();
  await expect(page.locator('.banner-error[role="alert"]')).toContainText("gateway-client-policy-denied");
  expect(proxyCalls).toBe(1);
});

test("expanded header editor remains within a mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await prepare(page);
  const panel = page.locator(".header-config");
  await panel.getByRole("button", { name: /^Claude Code/ }).click();
  await expect(panel.getByLabel("头值 2", { exact: true })).toHaveValue("claude-cli/2.1.63 (external, cli)");
  await expect(panel.getByLabel("启用请求头 4", { exact: true })).not.toBeChecked();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await panel.scrollIntoViewIfNeeded();
  await page.screenshot({ path: "test-results/header-config-mobile.png" });
});
