import { STANDARD_PROMPT, type Protocol, type ThinkingLevel } from "./constants";
import { buildEndpoint } from "./endpoints";
import { extractHtml, findExternalRefs } from "./extract";
import { siteFetch } from "./site-fetch";
import { assertHeaderTransport, buildRequestHeaders, redactRequestError, type HeaderEntry, type HeaderSettings } from "./request-headers";

export type Usage = { inputTokens: number | null; outputTokens: number | null; totalTokens: number | null };
export type RunResult = {
  ok: boolean;
  html: string | null;
  raw: string;
  thinkingText: string | null;
  fromFence: boolean;
  usage: Usage;
  durationMs: number;
  via: "direct" | "proxy";
  endpoint: string;
  error?: string;
  status?: number;
  externalRefs: string[];
};

type Upstream = { status: number; text: string };
type ConnectionOptions = {
  baseUrl: string;
  apiKey: string;
  protocol: Protocol;
  autoV1: boolean;
  allowProxy: boolean;
  headerSettings?: HeaderSettings;
  signal?: AbortSignal;
};
const emptyUsage: Usage = { inputTokens: null, outputTokens: null, totalTokens: null };

export function buildAuthHeaders(protocol: Protocol, apiKey: string, direct: boolean, entries: HeaderEntry[] = []) {
  return buildRequestHeaders(protocol, apiKey, direct, entries);
}

export function buildPayload(protocol: Protocol, model: string, thinking: ThinkingLevel, options?: {
  tokenField?: "max_tokens" | "max_completion_tokens";
  includeStore?: boolean;
}) {
  const outputCap = thinking === "max" ? 32000 : thinking === "high" ? 20000 : 16000;
  if (protocol === "openai-chat") {
    const body: Record<string, unknown> = {
      model,
      messages: [{ role: "user", content: STANDARD_PROMPT }],
      [options?.tokenField ?? "max_tokens"]: outputCap,
    };
    if (thinking !== "off") body.reasoning_effort = thinking === "max" ? "max" : thinking;
    return body;
  }
  if (protocol === "openai-responses") {
    const body: Record<string, unknown> = { model, input: STANDARD_PROMPT, max_output_tokens: outputCap };
    if (options?.includeStore !== false) body.store = false;
    if (thinking !== "off") body.reasoning = { effort: thinking === "max" ? "max" : thinking };
    return body;
  }
  const budget = thinking === "low" ? 1024 : thinking === "medium" ? 4096 : thinking === "high" ? 12000 : thinking === "max" ? 32000 : 0;
  const body: Record<string, unknown> = {
    model,
    max_tokens: thinking === "off" ? 16000 : Math.min(64000, budget + 16000),
    temperature: 1,
    messages: [{ role: "user", content: STANDARD_PROMPT }],
  };
  if (thinking !== "off") body.thinking = { type: "enabled", budget_tokens: budget };
  return body;
}

async function proxyCall(url: string, method: string, headers: Record<string, string>, body: unknown, signal?: AbortSignal): Promise<Upstream> {
  // Upstream headers belong in the body, NOT on the request to PelicanBench.
  const response = await siteFetch("/api/proxy", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, method, headers, body }),
    signal,
  });
  const data = await response.json().catch(() => null) as { error?: string; status?: number; body?: string } | null;
  if (!response.ok || !data || typeof data.status !== "number" || typeof data.body !== "string") {
    throw new Error(data?.error || `一次性中转失败（${response.status}）`);
  }
  return { status: data.status, text: data.body };
}

async function directCall(url: string, method: string, headers: Record<string, string>, body: unknown, signal?: AbortSignal): Promise<Upstream> {
  const response = await fetch(url, {
    method, headers, signal,
    body: body == null ? undefined : JSON.stringify(body),
    credentials: "omit",
    redirect: "error",
  });
  return { status: response.status, text: await response.text() };
}

class TransportError extends Error {
  constructor(message: string, public readonly via: "direct" | "proxy") { super(message); }
}

async function callUpstream(options: {
  url: string;
  method: "GET" | "POST";
  protocol: Protocol;
  apiKey: string;
  body: unknown;
  allowProxy: boolean;
  headerSettings?: HeaderSettings;
  signal?: AbortSignal;
}) {
  assertHeaderTransport(options.headerSettings);
  const entries = options.headerSettings?.entries ?? [];
  const runProxy = async () => {
    try {
      const upstream = await proxyCall(options.url, options.method, buildAuthHeaders(options.protocol, options.apiKey, false, entries), options.body, options.signal);
      return { ...upstream, via: "proxy" as const };
    } catch (error) {
      const message = error instanceof Error ? error.message : "一次性中转失败";
      throw new TransportError(redactRequestError(message, options.apiKey, options.headerSettings), "proxy");
    }
  };
  if (options.headerSettings?.transport === "proxy") return runProxy();

  const directHeaders = buildAuthHeaders(options.protocol, options.apiKey, true, entries);
  try {
    const upstream = await directCall(options.url, options.method, directHeaders, options.body, options.signal);
    // HTTP failures are returned to the user, not automatically duplicated.
    return { ...upstream, via: "direct" as const };
  } catch (error) {
    if (options.signal?.aborted) throw error;
    if (!options.allowProxy) {
      const message = error instanceof Error ? error.message : "浏览器无法直连";
      throw new TransportError(`${redactRequestError(message, options.apiKey, options.headerSettings)}。可能是跨域或网络限制。可打开「跨域失败时一次性中转」，服务端不会保存密钥。`, "direct");
    }
    return runProxy();
  }
}

function errorMessage(data: unknown, fallback: string) {
  if (!data || typeof data !== "object") return fallback;
  const record = data as Record<string, unknown>;
  const nested = record.error;
  if (typeof nested === "string" && nested.trim()) return nested;
  if (nested && typeof nested === "object") {
    const message = (nested as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  if (typeof record.message === "string" && record.message.trim()) return record.message;
  return fallback;
}

function num(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function usageFrom(data: unknown, protocol: Protocol): Usage {
  if (!data || typeof data !== "object") return emptyUsage;
  const usage = (data as { usage?: Record<string, unknown> }).usage;
  if (!usage) return emptyUsage;
  if (protocol === "anthropic") {
    const input = num(usage.input_tokens);
    const output = num(usage.output_tokens);
    return { inputTokens: input, outputTokens: output, totalTokens: input != null && output != null ? input + output : null };
  }
  const input = num(usage.prompt_tokens) ?? num(usage.input_tokens);
  const output = num(usage.completion_tokens) ?? num(usage.output_tokens);
  return { inputTokens: input, outputTokens: output, totalTokens: num(usage.total_tokens) ?? (input != null && output != null ? input + output : null) };
}

function textFrom(data: unknown, protocol: Protocol) {
  const thinking: string[] = [];
  const parts: string[] = [];
  if (!data || typeof data !== "object") return { text: "", thinking: null as string | null };
  const record = data as Record<string, unknown>;
  if (protocol === "openai-responses") {
    if (typeof record.output_text === "string") parts.push(record.output_text);
    const output = Array.isArray(record.output) ? record.output : [];
    for (const item of output) {
      if (!item || typeof item !== "object") continue;
      const content = (item as { content?: unknown }).content;
      if (!Array.isArray(content)) continue;
      for (const block of content) {
        if (!block || typeof block !== "object") continue;
        const typed = block as { type?: string; text?: string };
        if (typeof typed.text === "string") parts.push(typed.text);
      }
    }
  } else if (protocol === "anthropic") {
    const content = Array.isArray(record.content) ? record.content : [];
    for (const block of content) {
      if (!block || typeof block !== "object") continue;
      const typed = block as { type?: string; text?: string; thinking?: string };
      if (typed.type === "thinking" && typeof typed.thinking === "string") thinking.push(typed.thinking);
      if (typed.type === "text" && typeof typed.text === "string") parts.push(typed.text);
    }
  } else {
    const choice = Array.isArray(record.choices) ? record.choices[0] : undefined;
    const message = choice && typeof choice === "object" ? (choice as { message?: Record<string, unknown> }).message : undefined;
    const content = message?.content;
    if (typeof content === "string") parts.push(content);
    if (Array.isArray(content)) {
      for (const block of content) {
        if (typeof block === "string") parts.push(block);
        else if (block && typeof block === "object" && typeof (block as { text?: unknown }).text === "string") parts.push((block as { text: string }).text);
      }
    }
    if (typeof message?.reasoning_content === "string") thinking.push(message.reasoning_content);
  }
  return { text: parts.join("\n").trim(), thinking: thinking.join("\n").trim() || null };
}

function shouldRetry(message: string, protocol: Protocol, attempt: { tokenField: "max_tokens" | "max_completion_tokens"; includeStore: boolean }) {
  const lower = message.toLowerCase();
  if (protocol === "openai-chat" && attempt.tokenField === "max_tokens" && (lower.includes("max_completion_tokens") || lower.includes("max_tokens") && lower.includes("not supported") || lower.includes("unsupported parameter"))) {
    return { tokenField: "max_completion_tokens" as const, includeStore: attempt.includeStore };
  }
  if (protocol === "openai-responses" && attempt.includeStore && lower.includes("store")) return { tokenField: attempt.tokenField, includeStore: false };
  return null;
}

export async function runBench(options: ConnectionOptions & { model: string; thinking: ThinkingLevel }): Promise<RunResult> {
  const endpoint = buildEndpoint(options.baseUrl, options.protocol, options.autoV1);
  const started = performance.now();
  const initial: RunResult = {
    ok: false, html: null, raw: "", thinkingText: null, fromFence: false, usage: emptyUsage,
    durationMs: 0, via: options.headerSettings?.transport === "proxy" ? "proxy" : "direct",
    endpoint: "href" in endpoint ? endpoint.href : "", externalRefs: [],
  };
  if ("error" in endpoint) return { ...initial, error: endpoint.error };
  if (!options.apiKey.trim()) return { ...initial, error: "请填写 API Key。密钥只留在本机。" };
  if (!options.model.trim()) return { ...initial, error: "请填写或选择模型名。" };

  let attempt: { tokenField: "max_tokens" | "max_completion_tokens"; includeStore: boolean } = { tokenField: "max_tokens", includeStore: true };
  let via = initial.via;
  let last: Upstream | null = null;
  const redact = (text: string) => redactRequestError(text, options.apiKey, options.headerSettings);
  for (let i = 0; i < 2; i += 1) {
    const payload = buildPayload(options.protocol, options.model.trim(), options.thinking, attempt);
    try {
      const upstream = await callUpstream({
        url: endpoint.href, method: "POST", protocol: options.protocol, apiKey: options.apiKey.trim(), body: payload,
        allowProxy: options.allowProxy, headerSettings: options.headerSettings, signal: options.signal,
      });
      via = upstream.via;
      last = upstream;
    } catch (error) {
      const aborted = options.signal?.aborted || (error instanceof DOMException && error.name === "AbortError");
      return {
        ...initial, durationMs: Math.round(performance.now() - started), via: error instanceof TransportError ? error.via : via,
        error: aborted ? "已取消这次生成" : redact(error instanceof Error ? error.message : "请求失败"),
      };
    }
    let parsed: unknown = null;
    try { parsed = JSON.parse(last.text); } catch { /* Some gateways return HTML directly. */ }
    if (last.status >= 400) {
      const message = redact(errorMessage(parsed, last.text.slice(0, 500) || `接口返回 ${last.status}`));
      const next = shouldRetry(message, options.protocol, attempt);
      if (next && i === 0) { attempt = next; continue; }
      return {
        ...initial, raw: redact(last.text), usage: usageFrom(parsed, options.protocol), durationMs: Math.round(performance.now() - started),
        via, status: last.status, error: message,
      };
    }
    const extractedText = parsed ? textFrom(parsed, options.protocol).text : last.text;
    const thinkingText = parsed ? textFrom(parsed, options.protocol).thinking : null;
    const extracted = extractHtml(extractedText || last.text);
    const html = extracted.html;
    return {
      ok: Boolean(html), html, raw: redact(last.text), thinkingText, fromFence: extracted.fromFence,
      usage: usageFrom(parsed, options.protocol), durationMs: Math.round(performance.now() - started), via,
      endpoint: endpoint.href, status: last.status, error: html ? undefined : extracted.reason, externalRefs: html ? findExternalRefs(html) : [],
    };
  }
  return { ...initial, raw: redact(last?.text ?? ""), durationMs: Math.round(performance.now() - started), via, error: "请求失败" };
}

export function parseModelIds(data: unknown) {
  const ids = new Set<string>();
  const push = (value: unknown) => {
    if (typeof value === "string" && value.trim()) ids.add(value.trim());
    if (value && typeof value === "object" && "id" in value && typeof (value as { id?: unknown }).id === "string") ids.add((value as { id: string }).id);
  };
  if (Array.isArray(data)) data.forEach(push);
  if (data && typeof data === "object") {
    const record = data as { data?: unknown; models?: unknown };
    if (Array.isArray(record.data)) record.data.forEach(push);
    if (Array.isArray(record.models)) record.models.forEach(push);
  }
  return [...ids].sort((a, b) => a.localeCompare(b));
}

export async function listModels(options: ConnectionOptions) {
  const endpoint = buildEndpoint(options.baseUrl, options.protocol, options.autoV1, "models");
  if ("error" in endpoint) throw new Error(endpoint.error);
  if (!options.apiKey.trim()) throw new Error("请先填写 API Key");
  const upstream = await callUpstream({
    url: endpoint.href, method: "GET", protocol: options.protocol, apiKey: options.apiKey.trim(), body: null,
    allowProxy: options.allowProxy, headerSettings: options.headerSettings, signal: options.signal,
  });
  let parsed: unknown = null;
  try { parsed = JSON.parse(upstream.text); } catch { /* Error below explains invalid model responses. */ }
  if (upstream.status >= 400) throw new Error(redactRequestError(errorMessage(parsed, upstream.text.slice(0, 400) || `模型列表返回 ${upstream.status}`), options.apiKey, options.headerSettings));
  const models = parseModelIds(parsed);
  if (models.length === 0) throw new Error("接口没有返回可用的模型 id");
  return { models, via: upstream.via, endpoint: endpoint.href };
}
