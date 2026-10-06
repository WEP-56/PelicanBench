import { boolean, index, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const publicResults = pgTable(
  "public_results",
  {
    id: text("id").primaryKey(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    kind: text("kind").notNull().default("submission"),
    model: text("model").notNull(),
    protocol: text("protocol").notNull(),
    thinkingLevel: text("thinking_level").notNull(),
    channel: text("channel").notNull(),
    baseUrl: text("base_url"),
    html: text("html").notNull(),
    prompt: text("prompt").notNull(),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    totalTokens: integer("total_tokens"),
    durationMs: integer("duration_ms"),
    status: text("status").notNull().default("published"),
    nickname: text("nickname"),
    note: text("note"),
    verdict: text("verdict"),
    via: text("via"),
    hostMismatch: boolean("host_mismatch").notNull().default(false),
    ip: text("ip"),
    userAgent: text("user_agent"),
  },
  (t) => [
    index("public_results_created_idx").on(t.createdAt),
    index("public_results_status_idx").on(t.status),
    index("public_results_kind_idx").on(t.kind),
  ],
);

export const trafficEvents = pgTable(
  "traffic_events",
  {
    id: serial("id").primaryKey(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    event: text("event").notNull(),
    path: text("path").notNull(),
    ip: text("ip"),
    userAgent: text("user_agent"),
    referrer: text("referrer"),
    meta: text("meta"),
  },
  (t) => [
    index("traffic_created_idx").on(t.createdAt),
    index("traffic_event_idx").on(t.event),
  ],
);

export const ipBans = pgTable(
  "ip_bans",
  {
    id: serial("id").primaryKey(),
    ip: text("ip").notNull(),
    reason: text("reason"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
  },
  (t) => [index("ip_bans_ip_idx").on(t.ip)],
);

export const adminLogs = pgTable("admin_logs", {
  id: serial("id").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  action: text("action").notNull(),
  detail: text("detail"),
  ip: text("ip"),
});
