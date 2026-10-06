export const STANDARD_PROMPT =
  "请生成可直接运行的单文件HTML，使用内联SVG绘制鹈鹕骑自行车的二维循环动画。画面以鹈鹕和自行车为主体，展示清晰的身体结构、踩踏动作和车轮转动，配合协调的背景、配色与层次。动画应流畅自然、衔接连续，并适配不同屏幕尺寸。禁止依赖外部资源，只输出完整HTML，不要代码围栏或解释文字。";

export const PROTOCOLS = [
  {
    id: "openai-chat",
    label: "OpenAI Chat",
    short: "Chat",
    path: "/chat/completions",
    desc: "Chat Completions。兼容绝大多数官方账号与中转站。",
  },
  {
    id: "openai-responses",
    label: "OpenAI Responses",
    short: "Responses",
    path: "/responses",
    desc: "Responses API。OpenAI 新一代生成接口。",
  },
  {
    id: "anthropic",
    label: "Claude Messages",
    short: "Claude",
    path: "/messages",
    desc: "Anthropic Messages。Claude 原生协议。",
  },
] as const;

export type Protocol = (typeof PROTOCOLS)[number]["id"];

export const THINKING = [
  { id: "off", label: "关闭", openai: "不发送", claude: "不启用", hint: "不附加推理参数" },
  { id: "low", label: "低", openai: "low", claude: "1,024 tokens", hint: "轻量推理" },
  { id: "medium", label: "中", openai: "medium", claude: "4,096 tokens", hint: "对照常用档" },
  { id: "high", label: "高", openai: "high", claude: "12,000 tokens", hint: "较长思考" },
  { id: "max", label: "极高", openai: "max", claude: "32,000 tokens", hint: "尽可能拉满，部分接口会拒绝" },
] as const;

export type ThinkingLevel = (typeof THINKING)[number]["id"];

export const VERDICTS = [
  { id: "", label: "不表态" },
  { id: "authentic", label: "像真身" },
  { id: "unsure", label: "存疑" },
  { id: "degraded", label: "像被路由或降智" },
] as const;

export type Verdict = (typeof VERDICTS)[number]["id"];

export const CHECKLIST = [
  { id: "beak", label: "喙与喉囊分开，朝向合理" },
  { id: "body", label: "头、颈、身、翅、尾可以分开辨认" },
  { id: "wheels", label: "两个车轮独立，并且在转动" },
  { id: "frame", label: "车架、车座、车把、脚踏都在" },
  { id: "pedal", label: "踩踏和曲柄是同步的" },
  { id: "loop", label: "动画循环衔接，没有明显跳帧" },
  { id: "self", label: "没有依赖外部图片、字体或脚本" },
  { id: "fit", label: "缩放到不同宽度时主体仍然完整" },
] as const;

export const OFFICIAL_HOSTS = ["api.openai.com", "api.anthropic.com"];

export const DEFAULT_BASE: Record<Protocol, string> = {
  "openai-chat": "https://api.openai.com/v1",
  "openai-responses": "https://api.openai.com/v1",
  anthropic: "https://api.anthropic.com/v1",
};

export const MODEL_HINTS: Record<Protocol, string[]> = {
  "openai-chat": ["gpt-4.1", "gpt-4o", "o3", "o4-mini"],
  "openai-responses": ["gpt-4.1", "gpt-4o", "o3", "o4-mini"],
  anthropic: ["claude-sonnet-4-5", "claude-opus-4-1", "claude-3-7-sonnet-latest"],
};

export function protocolOf(id: string) {
  return PROTOCOLS.find((item) => item.id === id);
}

export function thinkingOf(id: string) {
  return THINKING.find((item) => item.id === id);
}

export function protocolLabel(id: string) {
  if (id === "reference") return "视觉基准";
  return protocolOf(id)?.label ?? id;
}

export function thinkingLabel(id: string) {
  return thinkingOf(id)?.label ?? (id === "n/a" ? "—" : id);
}

export function channelLabel(id: string) {
  if (id === "official") return "官方渠道";
  if (id === "third_party") return "第三方渠道";
  if (id === "reference") return "视觉基准";
  return id;
}

export function verdictLabel(id: string | null | undefined) {
  return VERDICTS.find((item) => item.id === (id ?? ""))?.label ?? "未表态";
}

export function verdictClass(id: string | null | undefined) {
  if (id === "authentic") return "verdict-authentic";
  if (id === "unsure") return "verdict-unsure";
  if (id === "degraded") return "verdict-degraded";
  return "";
}
