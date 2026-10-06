import type { Protocol, ThinkingLevel } from "./constants";

export const PREFS_KEY = "pb-prefs";
export const API_KEY_KEY = "pb-api-key";
export const HISTORY_KEY = "pb-history";

export type BenchPrefs = {
  baseUrl: string;
  protocol: Protocol;
  model: string;
  thinking: ThinkingLevel;
  rememberKey: boolean;
  allowProxy: boolean;
  autoV1: boolean;
  wantPublish: boolean;
  channel: "official" | "third_party";
  nickname: string;
};

export const defaultPrefs: BenchPrefs = {
  baseUrl: "https://api.openai.com/v1",
  protocol: "openai-chat",
  model: "",
  thinking: "medium",
  rememberKey: false,
  allowProxy: true,
  autoV1: true,
  wantPublish: false,
  channel: "official",
  nickname: "",
};

export type HistoryItem = {
  id: string;
  createdAt: string;
  model: string;
  protocol: Protocol;
  thinkingLevel: ThinkingLevel;
  baseUrl: string;
  channelPref: "official" | "third_party";
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  durationMs: number;
  html: string | null;
  rawPreview: string;
  prompt: string;
  ok: boolean;
  error?: string;
  via: "direct" | "proxy";
  fromFence: boolean;
  endpoint: string;
  uploadedId?: string;
  verdict?: string;
  checklist?: Record<string, boolean>;
  note?: string;
};

export function loadPrefs(): BenchPrefs {
  if (typeof window === "undefined") return defaultPrefs;
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return defaultPrefs;
    return { ...defaultPrefs, ...(JSON.parse(raw) as Partial<BenchPrefs>) };
  } catch {
    return defaultPrefs;
  }
}

export function savePrefs(prefs: BenchPrefs) {
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

export function loadApiKey(remember: boolean) {
  if (typeof window === "undefined") return "";
  const local = localStorage.getItem(API_KEY_KEY) ?? "";
  const session = sessionStorage.getItem(API_KEY_KEY) ?? "";
  if (remember && local) return local;
  return session || (remember ? local : "");
}

export function saveApiKey(key: string, remember: boolean) {
  sessionStorage.setItem(API_KEY_KEY, key);
  if (remember) localStorage.setItem(API_KEY_KEY, key);
  else localStorage.removeItem(API_KEY_KEY);
}

export function clearApiKey() {
  localStorage.removeItem(API_KEY_KEY);
  sessionStorage.removeItem(API_KEY_KEY);
}

export function loadHistory(): HistoryItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as HistoryItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveHistory(items: HistoryItem[]) {
  const next = items.slice(0, 40);
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  } catch {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next.slice(0, 12)));
  }
}

export function upsertHistory(item: HistoryItem) {
  const all = loadHistory().filter((entry) => entry.id !== item.id);
  saveHistory([item, ...all]);
}

export function clearHistory() {
  localStorage.removeItem(HISTORY_KEY);
}
