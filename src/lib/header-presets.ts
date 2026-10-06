import type { HeaderEntry } from "./request-headers";

export const HEADERS_RESEARCHED_AT = "2026-10-06";
export type HeaderPreset = {
  id: string;
  label: string;
  version: string;
  hint: string;
  detail: string;
  recommended: string;
  headers: { name: string; value: string; enabled?: boolean }[];
  sources: { title: string; url: string }[];
};

// Deliberately small, versioned snapshots, NOT complete CLI impersonation.
// No OAuth credentials, experimental-beta guesses, device IDs or account IDs.
export const HEADER_PRESETS: HeaderPreset[] = [
  {
    id: "default",
    label: "标准 API",
    version: "默认",
    hint: "不添加客户端标识",
    detail: "沿用协议生成的鉴权和 JSON 请求头。适用于官方 API 与大部分兼容接口。",
    recommended: "全部协议",
    headers: [],
    sources: [],
  },
  {
    id: "codex",
    label: "Codex CLI",
    version: "0.160.1",
    hint: "originator + User-Agent",
    detail: "依据官方 rust-v0.160.1 源码。User-Agent 只采用产品/版本前缀，不虚构本机 OS、架构和终端尾缀；如网关要求完整值，请按其文档编辑。",
    recommended: "OpenAI Responses",
    headers: [
      { name: "originator", value: "codex_cli_rs" },
      { name: "User-Agent", value: "codex_cli_rs/0.160.1" },
    ],
    sources: [
      { title: "Codex 官方源码 · rust-v0.160.1", url: "https://github.com/openai/codex/blob/rust-v0.160.1/codex-rs/login/src/auth/default_client.rs" },
    ],
  },
  {
    id: "opencode",
    label: "OpenCode",
    version: "1.18.34",
    hint: "User-Agent",
    detail: "依据官方 v1.18.34 源码的 opencode/<版本> 标识。省略运行时会话 ID、项目 ID 和 AI SDK 附加后缀，不把这些动态信息写死。",
    recommended: "全部协议",
    headers: [{ name: "User-Agent", value: "opencode/1.18.34" }],
    sources: [
      { title: "OpenCode 官方源码 · v1.18.34", url: "https://github.com/anomalyco/opencode/blob/v1.18.34/packages/opencode/src/session/llm/request.ts" },
    ],
  },
  {
    id: "claude-code",
    label: "Claude Code",
    version: "2.1.63 · 历史快照",
    hint: "x-app + User-Agent",
    detail: "标识来自可核验的官方 npm 2.1.63 发布包，并非声称当前最新版本。anthropic-beta 随能力和版本变化，预留空项但默认停用，不自动加入 OAuth 或实验能力。",
    recommended: "Claude Messages",
    headers: [
      { name: "x-app", value: "cli" },
      { name: "User-Agent", value: "claude-cli/2.1.63 (external, cli)" },
      { name: "anthropic-version", value: "2023-06-01" },
      { name: "anthropic-beta", value: "", enabled: false },
    ],
    sources: [
      { title: "Claude Code 官方 npm 发布包 · 2.1.63", url: "https://www.npmjs.com/package/@anthropic-ai/claude-code/v/2.1.63" },
      { title: "Anthropic 官方网关请求头说明", url: "https://code.claude.com/docs/en/llm-gateway-protocol#request-headers" },
    ],
  },
];

export const BROWSER_HEADER_SOURCE = "https://developer.mozilla.org/en-US/docs/Glossary/Forbidden_request_header";

export function presetEntries(id: string): HeaderEntry[] {
  const preset = HEADER_PRESETS.find((item) => item.id === id);
  return preset?.headers.map((header, index) => ({ id: `${id}-${index}`, name: header.name, value: header.value, enabled: header.enabled !== false })) ?? [];
}
