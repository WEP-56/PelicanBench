"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ApiError, requestJson as api } from "@/lib/api-client";
import { STANDARD_PROMPT, channelLabel, protocolLabel, thinkingLabel, verdictLabel } from "@/lib/constants";
import { formatCount, formatDuration, formatTime, formatTokens, shortUrl } from "@/lib/format";
import { PreviewFrame } from "./preview";
import { useSnackbar } from "./theme-provider";
import { Button, Dialog, LinearProgress, Segmented, TextArea, TextField } from "./ui";

type Section = "overview" | "results" | "traffic" | "bans";
type Session = { ok: boolean; configured: boolean };
type AdminResult = {
  id: string;
  createdAt: string;
  model: string;
  protocol: string;
  thinkingLevel: string;
  channel: string;
  baseUrl: string | null;
  status: string;
  nickname: string | null;
  note: string | null;
  verdict: string | null;
  durationMs: number | null;
  totalTokens: number | null;
  ip: string | null;
  hostMismatch: boolean;
  kind: string;
  html?: string;
  prompt?: string;
};
type Overview = {
  kpis: Record<string, number>;
  daily: { day: string; views: number }[];
  topPaths: { path: string; views: number }[];
  browsers: { browser: string; views: number }[];
  referrers: { referrer: string; views: number }[];
  channels: { channel: string; count: number }[];
  protocols: { protocol: string; count: number }[];
};

export function AdminApp() {
  const { notify } = useSnackbar();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [configured, setConfigured] = useState(true);
  const [password, setPassword] = useState("");
  const [loginBusy, setLoginBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [section, setSection] = useState<Section>("overview");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [results, setResults] = useState<AdminResult[]>([]);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [logs, setLogs] = useState<Array<Record<string, string | number | null>>>([]);
  const [logType, setLogType] = useState<"traffic" | "admin">("traffic");
  const [bans, setBans] = useState<Array<Record<string, string | number | boolean | null>>>([]);
  const [view, setView] = useState<AdminResult | null>(null);
  const [edit, setEdit] = useState<AdminResult | null>(null);
  const [creating, setCreating] = useState(false);
  const [banDraft, setBanDraft] = useState({ ip: "", reason: "", hours: "24" });

  const checkConnection = useCallback(async () => {
    setError("");
    try {
      const [, session] = await Promise.all([
        api<{ ok: boolean }>("/api/health"),
        api<Session>("/api/admin/session"),
      ]);
      setConfigured(session.configured);
      setAuthed(session.ok);
      if (!session.configured) setError("管理口令尚未配置，请设置 ADMIN_PASSWORD 并重启 Next.js 服务。");
    } catch (error) {
      setAuthed(false);
      setError(error instanceof Error ? error.message : "无法连接本站后端");
    }
  }, []);

  useEffect(() => {
    // This effect starts an external health/session check and updates its result asynchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void checkConnection();
  }, [checkConnection]);

  async function loadOverview() {
    setOverview(await api<Overview>("/api/admin/overview"));
  }
  async function loadResults(nextPage = page, nextQuery = query) {
    const data = await api<{ items: AdminResult[]; total: number }>(`/api/admin/results?page=${nextPage}&q=${encodeURIComponent(nextQuery)}`);
    setResults(data.items);
    setTotal(data.total);
  }
  async function loadLogs(type = logType) {
    const data = await api<{ items: Array<Record<string, string | number | null>> }>(`/api/admin/logs?type=${type}`);
    setLogs(data.items);
  }
  async function loadBans() {
    const data = await api<{ items: Array<Record<string, string | number | boolean | null>> }>("/api/admin/bans");
    setBans(data.items);
  }

  useEffect(() => {
    if (!authed) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mark the active section request as loading.
    setLoading(true);
    setError("");
    const run = section === "overview" ? loadOverview : section === "results" ? () => loadResults() : section === "traffic" ? () => loadLogs() : loadBans;
    void run().catch((error: unknown) => {
      if (cancelled) return;
      if (error instanceof ApiError && error.status === 401) setAuthed(false);
      setError(error instanceof Error ? error.message : "读取失败，请重试");
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed, section, logType]);

  async function login() {
    if (loginBusy) return;
    setLoginBusy(true);
    setError("");
    try {
      await api("/api/admin/login", { method: "POST", body: JSON.stringify({ password }) });
      const session = await api<Session>("/api/admin/session");
      if (!session.ok) throw new Error("浏览器未保存管理会话。请在独立窗口打开站点，或允许本站 Cookie 后重试。");
      setAuthed(true);
      setPassword("");
    } catch (error) {
      setError(error instanceof Error ? error.message : "登录失败");
    } finally {
      setLoginBusy(false);
    }
  }

  async function act(url: string, init: RequestInit, ok: string) {
    setError("");
    try {
      await api(url, init);
      notify(ok);
      if (section === "results") await loadResults();
      if (section === "bans") await loadBans();
      if (section === "overview") await loadOverview();
      return true;
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) setAuthed(false);
      setError(error instanceof Error ? error.message : "操作失败");
      return false;
    }
  }

  if (authed === null) return <div className="center-screen"><div className="skeleton" style={{ width: 320, height: 180 }} /></div>;
  if (!authed) {
    return (
      <div className="center-screen">
        <form className="md-card login-card stack" onSubmit={(event) => { event.preventDefault(); void login(); }}>
          <p className="eyebrow">PelicanBench</p>
          <h1 className="h2">管理入口</h1>
          <p className="muted">管理口令由站点环境变量 ADMIN_PASSWORD 配置。</p>
          {error ? <div className="banner-error" role="alert">{error}</div> : null}
          <TextField label="管理口令" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" disabled={loginBusy} />
          <Button type="submit" disabled={loginBusy || !configured || !password.trim()}>{loginBusy ? "验证中" : "进入"}</Button>
          <div className="cluster">
            <Button variant="text" onClick={() => void checkConnection()}>重新检查连接</Button>
            <Link className="md-btn md-btn-text" href="/docs#admin">返回文档</Link>
          </div>
          <a className="md-btn md-btn-outlined" href="/admin" target="_blank" rel="noopener noreferrer">在独立窗口打开管理页</a>
        </form>
      </div>
    );
  }

  return (
    <div className="page page-wide stack">
      <div className="cluster" style={{ justifyContent: "space-between" }}>
        <div>
          <p className="eyebrow">Admin</p>
          <h1 className="h2">公示、流量与封禁</h1>
        </div>
        <div className="cluster">
          <Link className="md-btn md-btn-text" href="/docs#admin">返回文档</Link>
          <Button variant="text" onClick={() => void act("/api/admin/logout", { method: "POST" }, "已退出").then((ok) => { if (ok) setAuthed(false); })}>退出</Button>
        </div>
      </div>
      <div className="admin-nav">
        {([
          ["overview", "概览"],
          ["results", "公示管理"],
          ["traffic", "日志"],
          ["bans", "封禁"],
        ] as const).map(([id, label]) => (
          <Button key={id} variant={section === id ? "filled" : "outlined"} onClick={() => setSection(id)}>{label}</Button>
        ))}
      </div>
      {loading ? <LinearProgress label="读取后台数据" /> : null}
      {error ? <div className="banner-error" role="alert">{error}</div> : null}

      {section === "overview" && overview ? (
        <div className="stack">
          <div className="stat-grid">
            {[
              ["公示中", overview.kpis.published],
              ["已隐藏", overview.kpis.hidden],
              ["24 小时访问", overview.kpis.views24h],
              ["24 小时地址", overview.kpis.unique24h],
              ["累计访问", overview.kpis.viewsTotal],
              ["累计地址", overview.kpis.uniqueTotal],
              ["上传次数", overview.kpis.uploads],
              ["中转次数", overview.kpis.proxies],
              ["有效封禁", overview.kpis.bans],
            ].map(([label, value]) => (
              <article key={String(label)} className="stat-card"><span>{label}</span><strong className="num">{formatCount(Number(value))}</strong></article>
            ))}
          </div>
          <section className="md-card">
            <h2 className="h3">近 14 日访问</h2>
            <div className="bar-chart" aria-label="近 14 日访问">
              {overview.daily.map((item) => (
                <div key={item.day} className="bar-col">
                  <div className="bar-track"><div className="bar-fill" style={{ height: `${(item.views / Math.max(1, ...overview.daily.map((day) => day.views))) * 100}%` }} /></div>
                  <span>{item.day}</span>
                </div>
              ))}
            </div>
          </section>
          <div className="split-2">
            <ListCard title="热门路径" rows={overview.topPaths.map((item) => [item.path, formatCount(item.views)])} />
            <ListCard title="浏览器" rows={overview.browsers.map((item) => [item.browser, formatCount(item.views)])} />
            <ListCard title="来源" rows={overview.referrers.map((item) => [item.referrer, formatCount(item.views)])} />
            <ListCard title="渠道 / 协议" rows={[...overview.channels.map((item) => [channelLabel(item.channel), formatCount(item.count)]), ...overview.protocols.map((item) => [protocolLabel(item.protocol), formatCount(item.count)])]} />
          </div>
        </div>
      ) : null}

      {section === "results" ? (
        <section className="md-card stack">
          <div className="cluster">
            <TextField label="搜索" value={query} onChange={(event) => setQuery(event.target.value)} />
            <Button variant="tonal" onClick={() => { setPage(1); void loadResults(1, query).catch((error: Error) => setError(error.message)); }}>搜索</Button>
            <Button onClick={() => setCreating(true)}>新增</Button>
          </div>
          <p className="field-support">视觉基准删除后，下次打开首页会重新放入。要撤下请隐藏。</p>
          <div className="md-table-wrap">
            <table className="md-table">
              <thead><tr><th>时间</th><th>模型</th><th>渠道</th><th>状态</th><th>地址</th><th /></tr></thead>
              <tbody>
                {results.map((item) => (
                  <tr key={item.id}>
                    <td>{formatTime(item.createdAt)}</td>
                    <td>{item.model}<div className="muted">{protocolLabel(item.protocol)} · {thinkingLabel(item.thinkingLevel)} · {formatTokens(item.totalTokens)} · {formatDuration(item.durationMs)}</div></td>
                    <td>{channelLabel(item.channel)}{item.hostMismatch ? " · 域名不一致" : ""}<div className="muted">{item.ip || "无 IP"}</div></td>
                    <td>{item.status === "hidden" ? "隐藏" : "公示"}<div className="muted">{verdictLabel(item.verdict)}</div></td>
                    <td className="mono">{item.baseUrl ? shortUrl(item.baseUrl) : "—"}</td>
                    <td>
                      <div className="cluster">
                        <Button size="sm" variant="text" onClick={() => void api<AdminResult>(`/api/admin/results/${item.id}`).then(setView).catch((error: Error) => setError(error.message))}>查看</Button>
                        <Button size="sm" variant="text" onClick={() => setEdit(item)}>编辑</Button>
                        <Button size="sm" variant="text" onClick={() => void act(`/api/admin/results/${item.id}`, { method: "PATCH", body: JSON.stringify({ status: item.status === "hidden" ? "published" : "hidden" }) }, "状态已更新")}>{item.status === "hidden" ? "公开" : "隐藏"}</Button>
                        <Button size="sm" variant="text" onClick={() => void act(`/api/admin/results/${item.id}`, { method: "DELETE" }, "已删除")}>删除</Button>
                        <Button size="sm" variant="text" disabled={!item.ip} onClick={() => { setBanDraft({ ip: item.ip || "", reason: "来自公示管理", hours: "24" }); setSection("bans"); }}>封禁</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="pager">
            <span className="muted">{total} 条</span>
            <div className="cluster">
              <Button variant="outlined" disabled={page <= 1} onClick={() => { const next = page - 1; setPage(next); void loadResults(next).catch((error: Error) => setError(error.message)); }}>上一页</Button>
              <Button variant="outlined" disabled={page * 20 >= total} onClick={() => { const next = page + 1; setPage(next); void loadResults(next).catch((error: Error) => setError(error.message)); }}>下一页</Button>
            </div>
          </div>
        </section>
      ) : null}

      {section === "traffic" ? (
        <section className="md-card stack">
          <Segmented value={logType} onChange={setLogType} options={[{ value: "traffic", label: "访问日志" }, { value: "admin", label: "管理日志" }]} />
          <div className="md-table-wrap">
            <table className="md-table">
              <thead><tr><th>时间</th><th>事件</th><th>路径 / 动作</th><th>地址</th><th>附加</th></tr></thead>
              <tbody>
                {logs.map((item, index) => (
                  <tr key={String(item.id ?? index)}>
                    <td>{formatTime(String(item.createdAt ?? ""))}</td>
                    <td>{String(item.event ?? item.action ?? "")}</td>
                    <td>{String(item.path ?? item.detail ?? "")}</td>
                    <td>{String(item.ip ?? "")}</td>
                    <td className="mono">{String(item.meta ?? item.userAgent ?? "").slice(0, 180)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {section === "bans" ? (
        <section className="md-card stack">
          <div className="split-2">
            <TextField label="IP" value={banDraft.ip} onChange={(event) => setBanDraft({ ...banDraft, ip: event.target.value })} />
            <TextField label="原因" value={banDraft.reason} onChange={(event) => setBanDraft({ ...banDraft, reason: event.target.value })} />
          </div>
          <Segmented value={banDraft.hours} onChange={(hours) => setBanDraft({ ...banDraft, hours })} options={[{ value: "1", label: "1 小时" }, { value: "24", label: "24 小时" }, { value: "168", label: "7 天" }, { value: "720", label: "30 天" }, { value: "0", label: "永久" }]} />
          <div><Button onClick={() => void act("/api/admin/bans", { method: "POST", body: JSON.stringify(banDraft) }, "已封禁")}>封禁</Button></div>
          <div className="md-table-wrap">
            <table className="md-table">
              <thead><tr><th>IP</th><th>原因</th><th>到期</th><th>状态</th><th /></tr></thead>
              <tbody>
                {bans.map((item) => (
                  <tr key={String(item.id)}>
                    <td className="mono">{String(item.ip)}</td>
                    <td>{String(item.reason || "—")}</td>
                    <td>{item.expiresAt ? formatTime(String(item.expiresAt)) : "永久"}</td>
                    <td>{item.active ? "生效" : "已解除"}</td>
                    <td>{item.active ? <Button size="sm" variant="text" onClick={() => void act(`/api/admin/bans/${item.id}`, { method: "DELETE" }, "已解除")}>解除</Button> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <Dialog open={Boolean(view)} title={view?.model || "查看"} wide onClose={() => setView(null)}>
        {view?.html ? <PreviewFrame html={view.html} title={view.model} /> : <p className="muted">没有 HTML</p>}
        {view?.note ? <p>{view.note}</p> : null}
      </Dialog>
      <Dialog open={Boolean(edit)} title="编辑公示" onClose={() => setEdit(null)} footer={<Button onClick={() => {
        if (!edit) return;
        void act(`/api/admin/results/${edit.id}`, { method: "PATCH", body: JSON.stringify(edit) }, "已保存").then((ok) => { if (ok) setEdit(null); });
      }}>保存</Button>}>
        {edit ? (
          <div className="stack">
            <TextField label="模型" value={edit.model} onChange={(event) => setEdit({ ...edit, model: event.target.value })} />
            <TextField label="昵称" value={edit.nickname || ""} onChange={(event) => setEdit({ ...edit, nickname: event.target.value })} />
            <TextArea label="备注" value={edit.note || ""} onChange={(event) => setEdit({ ...edit, note: event.target.value })} />
            <TextField label="域名，官方可留空" value={edit.baseUrl || ""} onChange={(event) => setEdit({ ...edit, baseUrl: event.target.value })} />
          </div>
        ) : null}
      </Dialog>
      <CreateDialog open={creating} onClose={() => setCreating(false)} onCreate={(body) => void act("/api/admin/results", { method: "POST", body: JSON.stringify(body) }, "已新增").then((ok) => { if (ok) setCreating(false); })} />
    </div>
  );
}

function ListCard({ title, rows }: { title: string; rows: string[][] }) {
  return (
    <section className="md-card">
      <h2 className="h3">{title}</h2>
      <div className="stack" style={{ marginTop: 12 }}>
        {rows.length === 0 ? <p className="muted">暂无</p> : rows.map((row) => (
          <div key={row.join("-")} className="cluster" style={{ justifyContent: "space-between" }}>
            <span>{row[0]}</span><strong className="num">{row[1]}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

function CreateDialog({ open, onClose, onCreate }: { open: boolean; onClose: () => void; onCreate: (body: Record<string, unknown>) => void }) {
  const [model, setModel] = useState("手动样本");
  const [html, setHtml] = useState("");
  const [channel, setChannel] = useState("official");
  const [baseUrl, setBaseUrl] = useState("");
  return (
    <Dialog open={open} title="新增公示" wide onClose={onClose} footer={<Button onClick={() => onCreate({ model, html, channel, baseUrl, protocol: "openai-chat", thinkingLevel: "off", nickname: "管理员", prompt: STANDARD_PROMPT })}>创建</Button>}>
      <div className="stack">
        <TextField label="模型" value={model} onChange={(event) => setModel(event.target.value)} />
        <Segmented value={channel} onChange={setChannel} options={[{ value: "official", label: "官方" }, { value: "third_party", label: "第三方" }]} />
        {channel === "third_party" ? <TextField label="域名" value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} /> : null}
        <TextArea label="HTML" value={html} onChange={(event) => setHtml(event.target.value)} support="需要包含内联 SVG" />
      </div>
    </Dialog>
  );
}
