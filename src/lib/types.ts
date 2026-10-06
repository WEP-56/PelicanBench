export type PublicResult = {
  id: string;
  createdAt: string;
  kind: string;
  model: string;
  protocol: string;
  thinkingLevel: string;
  channel: string;
  baseUrl: string | null;
  html: string;
  prompt: string;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  durationMs: number | null;
  nickname: string | null;
  note: string | null;
  verdict: string | null;
  via: string | null;
  hostMismatch: boolean;
  status?: string;
};

export type HomeStats = {
  submissions: number;
  models: number;
  thirdParty: number;
  official: number;
  references: number;
  avgDurationMs: number | null;
  avgOutputTokens: number | null;
  views24h: number;
  viewsTotal: number;
  unique24h: number;
  recent: PublicResult[];
  referencesItems: PublicResult[];
  dbReady: boolean;
};
