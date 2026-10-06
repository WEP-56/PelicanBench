import { expect, test, type APIRequestContext } from "@playwright/test";
import { STANDARD_PROMPT } from "../src/lib/constants";

const HTML = '<!DOCTYPE html><html lang="zh"><head><meta charset="utf-8"><title>回归测试</title></head><body><svg viewBox="0 0 400 200"><circle cx="100" cy="100" r="50" fill="#08665e"><animate attributeName="cx" values="100;300;100" dur="3s" repeatCount="indefinite"/></circle></svg></body></html>';

function origin(baseURL?: string) {
  return new URL(baseURL || "http://127.0.0.1:3000").origin;
}

async function login(request: APIRequestContext, baseURL?: string) {
  expect(process.env.ADMIN_PASSWORD, "ADMIN_PASSWORD must be configured for regression tests").toBeTruthy();
  const response = await request.post("/api/admin/login", {
    headers: { Origin: origin(baseURL) },
    data: { password: process.env.ADMIN_PASSWORD },
  });
  expect(response.status(), await response.text()).toBe(200);
  expect((await (await request.get("/api/admin/session")).json()).ok).toBe(true);
}

test.beforeEach(async ({ page }) => {
  await page.route("https://fonts.googleapis.com/**", (route) => route.abort());
  await page.route("https://fonts.gstatic.com/**", (route) => route.abort());
});

test("desktop navigation collapses to a rail, persists and expands", async ({ page }) => {
  await page.goto("/docs");
  const drawer = page.locator("#primary-navigation");
  await expect(page.getByRole("button", { name: "收起侧边栏", exact: true })).toBeVisible();
  await expect.poll(() => drawer.evaluate((element) => element.getBoundingClientRect().width)).toBe(304);
  await page.getByRole("button", { name: "收起侧边栏", exact: true }).click();
  await expect.poll(() => drawer.evaluate((element) => element.getBoundingClientRect().width)).toBe(88);
  await expect(page.getByRole("button", { name: "展开侧边栏", exact: true })).toHaveAttribute("aria-expanded", "false");
  await expect(drawer.locator(".brand-copy")).toBeHidden();
  await drawer.getByRole("link", { name: "测试", exact: true }).click();
  await expect(page).toHaveURL(/\/test$/);
  await page.reload();
  await expect.poll(() => drawer.evaluate((element) => element.getBoundingClientRect().width)).toBe(88);
  await page.getByRole("button", { name: "展开侧边栏", exact: true }).click();
  await expect.poll(() => drawer.evaluate((element) => element.getBoundingClientRect().width)).toBe(304);
  await expect(page.locator(".nav-scrim")).toHaveCount(0);
});

test("mobile document directory stays in flow and anchors clear the top bar", async ({ page }) => {
  for (const width of [375, 390, 768, 980]) {
    await page.setViewportSize({ width, height: 820 });
    await page.goto("/docs");
    const toc = page.getByRole("navigation", { name: "文档目录", exact: true });
    await expect(toc).toBeVisible();
    expect(await toc.evaluate((element) => getComputedStyle(element).position)).toBe("static");
    const tocBox = await toc.boundingBox();
    const firstBox = await page.locator("#what").boundingBox();
    expect(firstBox!.y).toBeGreaterThanOrEqual(tocBox!.y + tocBox!.height + 15);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    if (width === 375) await page.screenshot({ path: "test-results/docs-mobile-top.png" });
    await toc.getByRole("link", { name: "测试方法", exact: true }).click();
    await expect(page).toHaveURL(/#method$/);
    await expect.poll(() => page.locator("#method").evaluate((element) => Math.round(element.getBoundingClientRect().top))).toBeGreaterThanOrEqual(64);
    expect(await page.locator("#method").evaluate((element) => element.getBoundingClientRect().top)).toBeLessThan(120);
    expect(await toc.evaluate((element) => element.getBoundingClientRect().bottom)).toBeLessThan(64);
    if (width === 375) await page.screenshot({ path: "test-results/docs-mobile-anchor.png" });
  }
});

test("mobile drawer can be opened and closed without changing desktop collapse", async ({ page }) => {
  await page.goto("/docs");
  await page.getByRole("button", { name: "收起侧边栏", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 820 });
  await page.getByRole("button", { name: "打开导航", exact: true }).click();
  const drawer = page.getByRole("dialog", { name: "主导航", exact: true });
  await expect(drawer).toBeVisible();
  await expect.poll(() => drawer.evaluate((element) => Math.round(element.getBoundingClientRect().x))).toBe(0);
  await expect.poll(() => drawer.evaluate((element) => Math.round(element.getBoundingClientRect().top))).toBe(64);
  await expect(drawer.locator(".drawer-close")).toHaveCount(0);
  await page.getByRole("button", { name: "关闭导航", exact: true }).click();
  await expect(page.locator("#primary-navigation")).toHaveAttribute("aria-hidden", "true");
  await expect(page.locator(".nav-scrim")).toHaveCount(0);
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.getByRole("button", { name: "展开侧边栏", exact: true })).toBeVisible();
  await expect.poll(() => page.locator("#primary-navigation").evaluate((element) => element.getBoundingClientRect().width)).toBe(88);
});

test("generated pelican brand image loads without a duplicate close button in the drawer", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 820 });
  await page.goto("/docs");
  await page.getByRole("button", { name: "打开导航", exact: true }).click();
  const drawer = page.getByRole("dialog", { name: "主导航", exact: true });
  const mark = drawer.locator(".brand-mark");
  await expect(mark).toHaveAttribute("src", /pelican-mark\.png/);
  await expect.poll(() => mark.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
  await expect(drawer.locator(".drawer-close")).toHaveCount(0);
  await expect(drawer.getByRole("button", { name: "关闭导航", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "关闭导航", exact: true })).toBeVisible();
  await page.screenshot({ path: "test-results/mobile-generated-logo.png" });
});

test("proxied same-origin login succeeds and cross-site submissions stay blocked", async ({ request }) => {
  const host = "pelicanbench.preview.example";
  const proxyHeaders = { Origin: `https://${host}`, "X-Forwarded-Host": host, "X-Forwarded-Proto": "https", "X-Forwarded-For": "192.0.2.110" };
  const response = await request.post("/api/admin/login", {
    headers: proxyHeaders,
    data: { password: process.env.ADMIN_PASSWORD },
  });
  expect(response.status(), await response.text()).toBe(200);
  const cookies = response.headers()["set-cookie"];
  expect(cookies).toContain("HttpOnly");
  expect(cookies).toContain("Secure");
  const crossSite = await request.post("/api/results", {
    headers: { ...proxyHeaders, "Sec-Fetch-Site": "cross-site" },
    data: {},
  });
  expect(crossSite.status()).toBe(403);
  const wrongHost = await request.post("/api/admin/login", {
    headers: { ...proxyHeaders, Origin: "https://another-site.example" },
    data: { password: process.env.ADMIN_PASSWORD },
  });
  expect(wrongHost.status()).toBe(403);
});

test("backend uploads, admin CRUD, statistics, logs and bans work", async ({ request, baseURL }) => {
  const health = await request.get("/api/health");
  expect(health.status()).toBe(200);
  expect(await health.json()).toMatchObject({ ok: true, database: true, schemaReady: true, adminConfigured: true });
  expect((await request.get("/api/admin/overview")).status()).toBe(401);
  await login(request, baseURL);
  const headers = { Origin: origin(baseURL), "X-Forwarded-For": "192.0.2.111" };
  const ids: string[] = [];
  let banId: number | undefined;
  try {
    for (const channel of ["official", "third_party"]) {
      const upload = await request.post("/api/results", {
        headers,
        data: {
          html: HTML,
          model: `__regression__-${channel}`,
          protocol: "openai-chat",
          thinkingLevel: "medium",
          channel,
          baseUrl: "https://username:do-not-save@relay.example/v1?api_key=do-not-save#fragment",
          inputTokens: 100,
          outputTokens: 211,
          totalTokens: 311,
          durationMs: 2200,
          prompt: STANDARD_PROMPT,
          nickname: "回归检查",
        },
      });
      expect(upload.status(), await upload.text()).toBe(200);
      const id = (await upload.json()).id as string;
      ids.push(id);
      const publicResponse = await request.get(`/api/results/${id}`);
      expect(publicResponse.status()).toBe(200);
      const item = await publicResponse.json();
      expect(item).toMatchObject({ model: `__regression__-${channel}`, totalTokens: 311, durationMs: 2200, thinkingLevel: "medium" });
      expect(item.baseUrl).toBe(channel === "official" ? null : "relay.example");
      expect(JSON.stringify(item)).not.toContain("do-not-save");
      expect(item).not.toHaveProperty("ip");
      const adminResponse = await request.get(`/api/admin/results/${id}`);
      expect(adminResponse.status()).toBe(200);
      const adminItem = await adminResponse.json();
      expect(adminItem.baseUrl).toBe(channel === "official" ? null : "relay.example");
      expect((await request.patch(`/api/admin/results/${id}`, { headers, data: { status: "hidden" } })).status()).toBe(200);
      expect((await request.get(`/api/results/${id}`)).status()).toBe(404);
      expect((await request.patch(`/api/admin/results/${id}`, { headers, data: {
        status: "published",
        note: "编辑已验证",
        ...(channel === "third_party" ? { baseUrl: "https://relay.example/v2" } : {}),
      } })).status()).toBe(200);
      const updated = await (await request.get(`/api/results/${id}`)).json();
      expect(updated.note).toBe("编辑已验证");
      expect(updated.baseUrl).toBe(channel === "official" ? null : "relay.example");
    }
    const created = await request.post("/api/admin/results", {
      headers,
      data: { html: HTML, model: "__regression__-admin", protocol: "openai-chat", thinkingLevel: "off", channel: "official", prompt: STANDARD_PROMPT },
    });
    expect(created.status(), await created.text()).toBe(200);
    ids.push((await created.json()).id as string);
    expect((await request.get("/api/admin/overview")).status()).toBe(200);
    expect((await request.get("/api/admin/logs?type=traffic")).status()).toBe(200);
    expect((await request.get("/api/admin/logs?type=admin")).status()).toBe(200);
    const banned = await request.post("/api/admin/bans", { headers, data: { ip: "192.0.2.245", reason: "回归测试", hours: "1" } });
    expect(banned.status()).toBe(200);
    const bans = await (await request.get("/api/admin/bans")).json();
    const ban = bans.items.find((item: { ip: string; active: boolean }) => item.ip === "192.0.2.245" && item.active);
    expect(ban).toBeTruthy();
    banId = ban.id as number;
    expect((await request.delete(`/api/admin/bans/${banId}`, { headers })).status()).toBe(200);
  } finally {
    for (const id of ids) {
      expect((await request.delete(`/api/admin/results/${id}`, { headers })).status()).toBe(200);
    }
    if (banId) await request.delete(`/api/admin/bans/${banId}`, { headers });
  }
});

test("admin page logs in with a persisted cookie and displays real data", async ({ page }) => {
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "管理入口", exact: true })).toBeVisible();
  await page.getByLabel("管理口令", { exact: true }).fill(process.env.ADMIN_PASSWORD || "");
  await page.getByRole("button", { name: "进入", exact: true }).click();
  await expect(page.getByRole("heading", { name: "公示、流量与封禁", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "近 14 日访问", exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "公示、流量与封禁", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "公示管理", exact: true }).click();
  await expect(page.getByRole("table")).toBeVisible();
  await page.getByRole("button", { name: "日志", exact: true }).click();
  await expect(page.getByRole("table")).toBeVisible();
  await page.getByRole("button", { name: "封禁", exact: true }).click();
  await expect(page.getByRole("button", { name: "永久", exact: true })).toBeVisible();
});

test("history upload reports gateway errors persistently, then retries against the real backend", async ({ page, request, baseURL }) => {
  await page.addInitScript(({ html, prompt }) => {
    localStorage.setItem("pb-history", JSON.stringify([{
      id: "regression-local-result",
      createdAt: new Date().toISOString(),
      model: "__regression__-history-upload",
      protocol: "openai-chat",
      thinkingLevel: "medium",
      baseUrl: "https://api.openai.com/v1",
      channelPref: "official",
      inputTokens: 100,
      outputTokens: 211,
      totalTokens: 311,
      durationMs: 2200,
      html,
      rawPreview: "",
      prompt,
      ok: true,
      via: "direct",
      fromFence: false,
      endpoint: "https://api.openai.com/v1/chat/completions",
    }]));
  }, { html: HTML, prompt: STANDARD_PROMPT });
  let uploadedId: string | undefined;
  try {
    await page.goto("/history");
    await page.getByRole("button", { name: /__regression__-history-upload/ }).click();
    const dialog = page.getByRole("dialog", { name: "__regression__-history-upload", exact: true });
    await dialog.getByRole("switch", { name: "公示这条结果", exact: true }).click();
    await page.route("**/api/results", (route) => route.fulfill({ status: 503, contentType: "text/html", body: "<html>Gateway unavailable</html>" }));
    await dialog.getByRole("button", { name: "确认公示", exact: true }).click();
    await expect(dialog.getByRole("alert")).toContainText("本次结果仍在本机历史中");
    await expect(dialog.getByRole("button", { name: "重新公示", exact: true })).toBeVisible();
    await page.unroute("**/api/results");
    const responsePromise = page.waitForResponse((response) => response.url().endsWith("/api/results") && response.request().method() === "POST");
    await dialog.getByRole("button", { name: "重新公示", exact: true }).click();
    const uploaded = await responsePromise;
    expect(uploaded.status(), await uploaded.text()).toBe(200);
    uploadedId = (await uploaded.json()).id as string;
    await expect(dialog.getByRole("link", { name: "查看公示", exact: true })).toHaveAttribute("href", `/gallery/${uploadedId}`);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("pb-history") || "[]")[0].uploadedId)).toBe(uploadedId);
    expect((await request.get(`/api/results/${uploadedId}`)).status()).toBe(200);
  } finally {
    if (uploadedId) {
      await login(request, baseURL);
      expect((await request.delete(`/api/admin/results/${uploadedId}`, { headers: { Origin: origin(baseURL) } })).status()).toBe(200);
    }
  }
});
