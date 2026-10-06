import { and, count, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { adminLogs, ipBans, publicResults, trafficEvents } from "@/db/schema";
import { STANDARD_PROMPT } from "@/lib/constants";
import { resolveBase, hostnameOnly } from "@/lib/endpoints";
import type { PublicResult } from "@/lib/types";
import { REFERENCE_SAMPLES } from "@/content/reference-html";
import { HttpError } from "./http";

type Row = typeof publicResults.$inferSelect;

export function toPublic(row: Row, includeHtml = true): PublicResult {
  return {
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    kind: row.kind,
    model: row.model,
    protocol: row.protocol,
    thinkingLevel: row.thinkingLevel,
    channel: row.channel,
    baseUrl: row.channel === "third_party" ? hostnameOnly(row.baseUrl) : null,
    html: includeHtml ? row.html : "",
    prompt: row.prompt,
    inputTokens: row.inputTokens,
    outputTokens: row.outputTokens,
    totalTokens: row.totalTokens,
    durationMs: row.durationMs,
    nickname: row.nickname,
    note: row.note,
    verdict: row.verdict,
    via: row.via,
    hostMismatch: row.hostMismatch,
    status: row.status,
  };
}

export function toAdmin(row: Row, includeHtml = false) {
  return {
    ...toPublic(row, includeHtml),
    baseUrl: hostnameOnly(row.baseUrl),
    ip: row.ip,
    userAgent: row.userAgent,
    status: row.status,
  };
}

export async function logEvent(input: {
  event: string;
  path: string;
  ip?: string | null;
  userAgent?: string | null;
  referrer?: string | null;
  meta?: unknown;
}) {
  await db.insert(trafficEvents).values({
    event: input.event.slice(0, 40),
    path: input.path.slice(0, 300),
    ip: input.ip ?? null,
    userAgent: input.userAgent?.slice(0, 300) ?? null,
    referrer: input.referrer?.slice(0, 300) ?? null,
    meta: input.meta ? JSON.stringify(input.meta).slice(0, 2000) : null,
  });
}

export async function logAdmin(action: string, detail: string, ip: string) {
  await db.insert(adminLogs).values({
    action: action.slice(0, 60),
    detail: detail.slice(0, 2000),
    ip,
  });
}

function textOf(value: unknown, min: number, max: number, label: string) {
  if (typeof value !== "string") throw new HttpError(400, `${label}无效`);
  const cleaned = value.trim();
  if (cleaned.length < min || cleaned.length > max) throw new HttpError(400, `${label}长度不符合要求`);
  return cleaned;
}

function optionalText(value: unknown, max: number) {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u001f]/g, "").trim().slice(0, max);
}

function intOrNull(value: unknown, max: number) {
  if (value == null || value === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > max) return null;
  return Math.round(number);
}

const PROTOCOLS = new Set(["openai-chat", "openai-responses", "anthropic", "reference"]);
const THINKING = new Set(["off", "low", "medium", "high", "max"]);
const CHANNELS = new Set(["official", "third_party", "reference"]);
const VERDICTS = new Set(["", "authentic", "unsure", "degraded"]);

export function validateSubmission(body: unknown, admin = false) {
  if (!body || typeof body !== "object") throw new HttpError(400, "请求格式不正确");
  const record = body as Record<string, unknown>;
  if (!admin && record.website) throw new HttpError(400, "请求被拒绝");
  const model = textOf(record.model, 1, 120, "模型名");
  const protocol = textOf(record.protocol, 1, 40, "协议");
  if (!PROTOCOLS.has(protocol) || (!admin && protocol === "reference")) throw new HttpError(400, "协议不被接受");
  const thinkingLevel = textOf(record.thinkingLevel, 1, 20, "思考强度");
  if (!THINKING.has(thinkingLevel)) throw new HttpError(400, "思考强度不被接受");
  const channel = textOf(record.channel, 1, 40, "渠道");
  if (!CHANNELS.has(channel) || (!admin && channel === "reference")) throw new HttpError(400, "渠道不被接受");
  const html = textOf(record.html, 20, 1_500_000, "HTML");
  if (!/<svg[\s>]/i.test(html)) throw new HttpError(400, "公示内容需要包含内联 SVG");
  const prompt = typeof record.prompt === "string" && record.prompt.trim() ? record.prompt.trim() : STANDARD_PROMPT;
  if (!admin && prompt !== STANDARD_PROMPT) throw new HttpError(400, "公示只接受标准提示词生成的结果");
  let baseUrl: string | null = null;
  if (channel === "third_party") {
    const raw = textOf(record.baseUrl, 8, 300, "Base URL");
    const resolved = resolveBase(raw, true);
    if ("error" in resolved) throw new HttpError(400, resolved.error);
    baseUrl = hostnameOnly(resolved.href);
    if (!baseUrl) throw new HttpError(400, "Base URL 域名无效");
  }
  const verdict = optionalText(record.verdict, 20);
  if (!VERDICTS.has(verdict)) throw new HttpError(400, "判断不被接受");
  const via = record.via === "direct" || record.via === "proxy" ? record.via : null;
  return {
    model,
    protocol,
    thinkingLevel,
    channel,
    baseUrl,
    html,
    prompt,
    inputTokens: intOrNull(record.inputTokens, 2_000_000),
    outputTokens: intOrNull(record.outputTokens, 2_000_000),
    totalTokens: intOrNull(record.totalTokens, 4_000_000),
    durationMs: intOrNull(record.durationMs, 900_000),
    nickname: optionalText(record.nickname, 24) || "匿名测试者",
    note: optionalText(record.note, 280) || null,
    verdict: verdict || null,
    via,
    hostMismatch: record.hostMismatch === true,
  };
}

export async function ensureSeed() {
  for (const sample of REFERENCE_SAMPLES) {
    const row = {
      id: sample.id,
      kind: "reference",
      model: sample.model,
      protocol: "reference",
      thinkingLevel: "off",
      channel: "reference",
      baseUrl: null,
      html: sample.html,
      prompt: STANDARD_PROMPT,
      status: "published",
      nickname: "PelicanBench",
      note: sample.note,
      verdict: null,
      via: null,
      hostMismatch: false,
      ip: null,
      userAgent: null,
    };
    await db
      .insert(publicResults)
      .values(row)
      .onConflictDoUpdate({
        target: publicResults.id,
        set: {
          html: sample.html,
          note: sample.note,
          model: sample.model,
          prompt: STANDARD_PROMPT,
          kind: "reference",
          channel: "reference",
        },
      });
  }
}

function rowsOf<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  if (result && typeof result === "object" && "rows" in result && Array.isArray((result as { rows: unknown }).rows)) {
    return (result as { rows: T[] }).rows;
  }
  return [];
}

export async function queryResults(options: {
  kind?: string;
  channel?: string;
  protocol?: string;
  thinking?: string;
  verdict?: string;
  q?: string;
  status?: string;
  sort?: string;
  page?: number;
  pageSize?: number;
  includeHidden?: boolean;
}) {
  const filters: SQL[] = [];
  if (!options.includeHidden) filters.push(eq(publicResults.status, "published"));
  else if (options.status && options.status !== "all") filters.push(eq(publicResults.status, options.status));
  if (options.kind && options.kind !== "all") filters.push(eq(publicResults.kind, options.kind));
  if (options.channel && options.channel !== "all") filters.push(eq(publicResults.channel, options.channel));
  if (options.protocol && options.protocol !== "all") filters.push(eq(publicResults.protocol, options.protocol));
  if (options.thinking && options.thinking !== "all") filters.push(eq(publicResults.thinkingLevel, options.thinking));
  if (options.verdict && options.verdict !== "all") filters.push(eq(publicResults.verdict, options.verdict));
  if (options.q) {
    const like = `%${options.q.replace(/[%_]/g, "").slice(0, 80)}%`;
    const search = or(ilike(publicResults.model, like), ilike(publicResults.nickname, like), ilike(publicResults.baseUrl, like), ilike(publicResults.note, like));
    if (search) filters.push(search);
  }
  const where = filters.length ? and(...filters) : undefined;
  const pageSize = Math.min(24, Math.max(1, options.pageSize ?? 12));
  const page = Math.max(1, options.page ?? 1);
  const order =
    options.sort === "duration"
      ? sql`${publicResults.durationMs} desc nulls last`
      : options.sort === "tokens"
        ? sql`${publicResults.totalTokens} desc nulls last`
        : desc(publicResults.createdAt);
  const [totalRow] = await db.select({ c: count() }).from(publicResults).where(where);
  const rows = await db
    .select()
    .from(publicResults)
    .where(where)
    .orderBy(order)
    .limit(pageSize)
    .offset((page - 1) * pageSize);
  return { rows, total: Number(totalRow?.c ?? 0), page, pageSize };
}

export async function getResult(id: string) {
  const [row] = await db.select().from(publicResults).where(eq(publicResults.id, id)).limit(1);
  return row ?? null;
}

export async function getHomeStats() {
  const published = and(eq(publicResults.kind, "submission"), eq(publicResults.status, "published"));
  const [submissionRow] = await db.select({ c: count() }).from(publicResults).where(published);
  const [thirdRow] = await db
    .select({ c: count() })
    .from(publicResults)
    .where(and(published, eq(publicResults.channel, "third_party")));
  const [officialRow] = await db
    .select({ c: count() })
    .from(publicResults)
    .where(and(published, eq(publicResults.channel, "official")));
  const [referenceRow] = await db
    .select({ c: count() })
    .from(publicResults)
    .where(and(eq(publicResults.kind, "reference"), eq(publicResults.status, "published")));
  const modelRows = await db.selectDistinct({ model: publicResults.model }).from(publicResults).where(published);
  const [avgRow] = await db
    .select({
      duration: sql<number | null>`avg(${publicResults.durationMs})`,
      output: sql<number | null>`avg(${publicResults.outputTokens})`,
    })
    .from(publicResults)
    .where(published);
  const [viewsTotalRow] = await db.select({ c: count() }).from(trafficEvents).where(eq(trafficEvents.event, "pageview"));
  const views24 = await db.execute(sql`select count(*)::int as c from traffic_events where event = 'pageview' and created_at > now() - interval '24 hours'`);
  const unique24 = await db.execute(sql`select count(distinct ip)::int as c from traffic_events where event = 'pageview' and created_at > now() - interval '24 hours'`);
  const recent = await db.select().from(publicResults).where(published).orderBy(desc(publicResults.createdAt)).limit(6);
  const references = await db
    .select()
    .from(publicResults)
    .where(and(eq(publicResults.kind, "reference"), eq(publicResults.status, "published")))
    .orderBy(publicResults.createdAt)
    .limit(6);
  const viewRows = rowsOf<{ c: number }>(views24);
  const uniqueRows = rowsOf<{ c: number }>(unique24);
  return {
    submissions: Number(submissionRow?.c ?? 0),
    models: modelRows.length,
    thirdParty: Number(thirdRow?.c ?? 0),
    official: Number(officialRow?.c ?? 0),
    references: Number(referenceRow?.c ?? 0),
    avgDurationMs: avgRow?.duration == null ? null : Math.round(Number(avgRow.duration)),
    avgOutputTokens: avgRow?.output == null ? null : Math.round(Number(avgRow.output)),
    views24h: Number(viewRows[0]?.c ?? 0),
    viewsTotal: Number(viewsTotalRow?.c ?? 0),
    unique24h: Number(uniqueRows[0]?.c ?? 0),
    recent: recent.map((row) => toPublic(row)),
    referencesItems: references.map((row) => toPublic(row)),
    dbReady: true,
  };
}

export async function getAdminOverview() {
  const dayKeys = Array.from({ length: 14 }, (_, index) => {
    const date = new Date(Date.now() - (13 - index) * 86400000);
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
  });
  const dailyResult = await db.execute(sql`
    select to_char(created_at at time zone 'Asia/Shanghai', 'YYYY-MM-DD') as day, count(*)::int as views
    from traffic_events
    where event = 'pageview' and created_at > now() - interval '14 days'
    group by 1
  `);
  const dailyMap = new Map(rowsOf<{ day: string; views: number }>(dailyResult).map((row) => [row.day, Number(row.views)]));
  const topPaths = rowsOf<{ path: string; views: number }>(
    await db.execute(sql`
      select path, count(*)::int as views
      from traffic_events
      where event = 'pageview'
      group by path
      order by views desc
      limit 8
    `),
  );
  const browsers = rowsOf<{ browser: string; views: number }>(
    await db.execute(sql`
      select case
        when user_agent ilike '%Edg/%' then 'Edge'
        when user_agent ilike '%Chrome/%' then 'Chrome'
        when user_agent ilike '%Firefox/%' then 'Firefox'
        when user_agent ilike '%Safari/%' then 'Safari'
        else '其他'
      end as browser, count(*)::int as views
      from traffic_events
      where event = 'pageview'
      group by 1
      order by views desc
    `),
  );
  const referrers = rowsOf<{ referrer: string; views: number }>(
    await db.execute(sql`
      select coalesce(nullif(referrer, ''), '直接访问') as referrer, count(*)::int as views
      from traffic_events
      where event = 'pageview'
      group by 1
      order by views desc
      limit 6
    `),
  );
  const [views24] = rowsOf<{ c: number }>(await db.execute(sql`select count(*)::int as c from traffic_events where event = 'pageview' and created_at > now() - interval '24 hours'`));
  const [unique24] = rowsOf<{ c: number }>(await db.execute(sql`select count(distinct ip)::int as c from traffic_events where event = 'pageview' and created_at > now() - interval '24 hours'`));
  const [viewsTotal] = await db.select({ c: count() }).from(trafficEvents).where(eq(trafficEvents.event, "pageview"));
  const [uniqueTotal] = rowsOf<{ c: number }>(await db.execute(sql`select count(distinct ip)::int as c from traffic_events where event = 'pageview'`));
  const [uploads] = await db.select({ c: count() }).from(trafficEvents).where(eq(trafficEvents.event, "upload"));
  const [proxies] = await db.select({ c: count() }).from(trafficEvents).where(eq(trafficEvents.event, "proxy"));
  const [published] = await db.select({ c: count() }).from(publicResults).where(and(eq(publicResults.kind, "submission"), eq(publicResults.status, "published")));
  const [hidden] = await db.select({ c: count() }).from(publicResults).where(eq(publicResults.status, "hidden"));
  const channels = await db
    .select({ channel: publicResults.channel, c: count() })
    .from(publicResults)
    .where(eq(publicResults.kind, "submission"))
    .groupBy(publicResults.channel);
  const protocols = await db
    .select({ protocol: publicResults.protocol, c: count() })
    .from(publicResults)
    .where(eq(publicResults.kind, "submission"))
    .groupBy(publicResults.protocol);
  const [activeBans] = await db.select({ c: count() }).from(ipBans).where(eq(ipBans.active, true));
  return {
    kpis: {
      published: Number(published?.c ?? 0),
      hidden: Number(hidden?.c ?? 0),
      views24h: Number(views24?.c ?? 0),
      unique24h: Number(unique24?.c ?? 0),
      viewsTotal: Number(viewsTotal?.c ?? 0),
      uniqueTotal: Number(uniqueTotal?.c ?? 0),
      uploads: Number(uploads?.c ?? 0),
      proxies: Number(proxies?.c ?? 0),
      bans: Number(activeBans?.c ?? 0),
    },
    daily: dayKeys.map((day) => ({ day: day.slice(5), views: dailyMap.get(day) ?? 0 })),
    topPaths: topPaths.map((row) => ({ path: row.path, views: Number(row.views) })),
    browsers: browsers.map((row) => ({ browser: row.browser, views: Number(row.views) })),
    referrers: referrers.map((row) => ({ referrer: row.referrer, views: Number(row.views) })),
    channels: channels.map((row) => ({ channel: row.channel, count: Number(row.c) })),
    protocols: protocols.map((row) => ({ protocol: row.protocol, count: Number(row.c) })),
  };
}
