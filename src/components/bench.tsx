"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CHECKLIST,
  DEFAULT_BASE,
  MODEL_HINTS,
  STANDARD_PROMPT,
  THINKING,
  VERDICTS,
  protocolOf,
  type Protocol,
  type ThinkingLevel,
} from "@/lib/constants";
import { buildEndpoint, isDefaultBase, resolveBase } from "@/lib/endpoints";
import { openIsolated } from "@/lib/extract";
import { copyText, downloadHtml, formatDuration, formatTokens, safeFilename } from "@/lib/format";
import { listModels, runBench, type RunResult } from "@/lib/llm-client";
import { EMPTY_HEADER_SETTINGS, inspectHeaders, type HeaderSettings } from "@/lib/request-headers";
import { HeaderEditor } from "./header-editor";
import {
  loadApiKey,
  loadPrefs,
  saveApiKey,
  savePrefs,
  upsertHistory,
  type BenchPrefs,
  type HistoryItem,
} from "@/lib/storage";
import { IconCode, IconDownload, IconEye, IconPrompt } from "./icons";
import { PreviewFrame } from "./preview";
import { PublishForm } from "./publish-form";
import { useSnackbar } from "./theme-provider";
import { Button, Dialog, LinearProgress, Segmented, Switch, TextField } from "./ui";

export function Bench() {
  const { notify } = useSnackbar();
  const [ready, setReady] = useState(false);
  const [prefs, setPrefs] = useState<BenchPrefs>(loadPrefs());
  const [apiKey, setApiKey] = useState("");
  const [headerSettings, setHeaderSettings] = useState<HeaderSettings>(() => ({ ...EMPTY_HEADER_SETTINGS, entries: [] }));
  const [connectionError, setConnectionError] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<RunResult | null>(null);
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [uploadedId, setUploadedId] = useState<string | null>(null);
  const [models, setModels] = useState<string[]>([]);
  const [modelsOpen, setModelsOpen] = useState(false);
  const [modelQuery, setModelQuery] = useState("");
  const [modelsLoading, setModelsLoading] = useState(false);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [promptOpen, setPromptOpen] = useState(false);
  const [rawOpen, setRawOpen] = useState(false);
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [verdict, setVerdict] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const startRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    const loaded = loadPrefs();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- restore browser-only preferences after hydration.
    setPrefs(loaded);
    setApiKey(loadApiKey(loaded.rememberKey));
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    savePrefs(prefs);
  }, [prefs, ready]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        startRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    startRef.current = () => void generate();
  });

  const endpoint = useMemo(() => buildEndpoint(prefs.baseUrl, prefs.protocol, prefs.autoV1), [prefs.baseUrl, prefs.protocol, prefs.autoV1]);
  const checkedHeaders = inspectHeaders(headerSettings.entries);
  const headerError = checkedHeaders.errors[0]?.message || (
    headerSettings.transport === "proxy" && !prefs.allowProxy
      ? "一次性中转已关闭，当前请求不会发往本站代理。请切换为浏览器优先；若配置了 User-Agent，请停用该头或重新开启中转。"
      : checkedHeaders.needsProxy && headerSettings.transport !== "proxy"
        ? "User-Agent 需要一次性中转，请在请求头配置中明确启用，或停用该头。"
        : ""
  );
  const thinking = THINKING.find((item) => item.id === prefs.thinking);
  const hints = models.length ? models : MODEL_HINTS[prefs.protocol];
  const filteredModels = models.filter((item) => item.toLowerCase().includes(modelQuery.toLowerCase()));

  function patch(partial: Partial<BenchPrefs>) {
    setPrefs((current) => ({ ...current, ...partial }));
  }

  function changeProtocol(protocol: Protocol) {
    setPrefs((current) => ({
      ...current,
      protocol,
      baseUrl: !current.baseUrl.trim() || isDefaultBase(current.baseUrl) ? DEFAULT_BASE[protocol] : current.baseUrl,
    }));
    setModels([]);
  }

  async function fetchModels() {
    if (headerError) { setConnectionError(headerError); return; }
    setConnectionError("");
    setModelsLoading(true);
    try {
      const data = await listModels({
        baseUrl: prefs.baseUrl,
        apiKey,
        protocol: prefs.protocol,
        autoV1: prefs.autoV1,
        allowProxy: prefs.allowProxy,
        headerSettings,
      });
      setModels(data.models);
      setModelsOpen(true);
      notify(`已读取 ${data.models.length} 个模型${data.via === "proxy" ? "，经由一次性中转" : ""}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "模型列表获取失败";
      setConnectionError(message);
      notify(message);
    } finally {
      setModelsLoading(false);
    }
  }

  async function generate() {
    if (running) return;
    if (headerError) { setConnectionError(headerError); return; }
    setConnectionError("");
    setRunning(true);
    setResult(null);
    setUploadedId(null);
    setChecklist({});
    setVerdict("");
    const controller = new AbortController();
    abortRef.current = controller;
    const started = performance.now();
    setElapsed(0);
    const timer = window.setInterval(() => setElapsed(performance.now() - started), 200);
    saveApiKey(apiKey, prefs.rememberKey);
    try {
      const outcome = await runBench({
        baseUrl: prefs.baseUrl,
        apiKey,
        protocol: prefs.protocol,
        model: prefs.model,
        thinking: prefs.thinking,
        autoV1: prefs.autoV1,
        allowProxy: prefs.allowProxy,
        headerSettings,
        signal: controller.signal,
      });
      setResult(outcome);
      const item: HistoryItem = {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        model: prefs.model.trim() || "未命名",
        protocol: prefs.protocol,
        thinkingLevel: prefs.thinking,
        baseUrl: (() => {
          const resolved = resolveBase(prefs.baseUrl, prefs.autoV1);
          return "href" in resolved ? resolved.href : prefs.baseUrl;
        })(),
        channelPref: prefs.channel,
        inputTokens: outcome.usage.inputTokens,
        outputTokens: outcome.usage.outputTokens,
        totalTokens: outcome.usage.totalTokens,
        durationMs: outcome.durationMs,
        html: outcome.html,
        rawPreview: outcome.raw.slice(0, 20000),
        prompt: STANDARD_PROMPT,
        ok: outcome.ok,
        error: outcome.error,
        via: outcome.via,
        fromFence: outcome.fromFence,
        endpoint: outcome.endpoint,
      };
      upsertHistory(item);
      setHistoryId(item.id);
      notify(outcome.ok
        ? outcome.via === "proxy"
          ? "已通过一次性中转完成生成。本站未保存密钥或请求头。"
          : "浏览器已直连上游完成生成，未经过本站服务器。"
        : outcome.error || "没有得到可渲染的 HTML");
    } finally {
      window.clearInterval(timer);
      setRunning(false);
    }
  }

  function rememberChecklist(next: Record<string, boolean>, nextVerdict = verdict) {
    if (!historyId) return;
    const all = JSON.parse(localStorage.getItem("pb-history") || "[]") as HistoryItem[];
    const updated = all.map((item) => item.id === historyId ? { ...item, checklist: next, verdict: nextVerdict } : item);
    localStorage.setItem("pb-history", JSON.stringify(updated));
  }

  if (!ready) {
    return <div className="page"><div className="skeleton" style={{ height: 280 }} /></div>;
  }

  return (
    <div className="page page-wide">
      <div className="bench-grid">
        <div className="stack">
          <section className="md-card stack">
            <div>
              <p className="eyebrow">连接</p>
              <h2 className="h3">只把请求发给你填写的地址</h2>
            </div>
            <TextField
              label="Base URL"
              value={prefs.baseUrl}
              onChange={(event) => patch({ baseUrl: event.target.value })}
              support="密钥不要写进地址。查询参数会被去掉。"
              autoComplete="off"
              spellCheck={false}
            />
            <TextField
              label="API Key"
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(event) => {
                setApiKey(event.target.value);
                saveApiKey(event.target.value, prefs.rememberKey);
              }}
              autoComplete="off"
              spellCheck={false}
              support="只存在这台浏览器。服务器日志不会记录它。"
              trailing={<button type="button" className="md-btn md-btn-text md-icon-btn" aria-label={showKey ? "隐藏密钥" : "显示密钥"} onClick={() => setShowKey((value) => !value)}><IconEye off={showKey} /></button>}
            />
            <Switch checked={prefs.rememberKey} onChange={(rememberKey) => { patch({ rememberKey }); saveApiKey(apiKey, rememberKey); }} label="在这台浏览器记住密钥" support="关掉后，关闭标签页即忘记。" />
            <Segmented
              label="协议"
              value={prefs.protocol}
              onChange={changeProtocol}
              options={[
                { value: "openai-chat", label: "OpenAI Chat" },
                { value: "openai-responses", label: "Responses" },
                { value: "anthropic", label: "Claude" },
              ]}
            />
            <p className="field-support">{protocolOf(prefs.protocol)?.desc}</p>
            <p className="mono muted">{"href" in endpoint ? `POST ${endpoint.href}` : endpoint.error}</p>
            <Switch checked={prefs.autoV1} onChange={(autoV1) => patch({ autoV1 })} label="自动补全 /v1" support="地址已经带版本路径时不会重复追加。" />
            <Switch checked={prefs.allowProxy} onChange={(allowProxy) => {
              patch({ allowProxy });
              if (!allowProxy && headerSettings.transport === "proxy") setHeaderSettings({ ...headerSettings, transport: "auto" });
            }} label="跨域失败时一次性中转" support={prefs.allowProxy
              ? "只在浏览器直连失败时中转。请求头配置也可明确要求始终中转。"
              : "关闭后不会使用本站中转，包括请求头配置中的始终中转。"
            } />
          </section>

          <HeaderEditor
            value={headerSettings}
            onChange={(next) => { setHeaderSettings(next); setConnectionError(""); setModels([]); }}
            protocol={prefs.protocol}
            disabled={running || modelsLoading}
          />
          {headerError ? <div className="header-transport-warning" role="status">{headerError}</div> : null}
          {connectionError ? <div className="banner-error" role="alert">{connectionError}</div> : null}

          <section className="md-card stack">
            <div className="cluster" style={{ justifyContent: "space-between" }}>
              <div>
                <p className="eyebrow">模型</p>
                <h2 className="h3">从接口读取，或自己填写</h2>
              </div>
              <Button variant="tonal" onClick={() => void fetchModels()} disabled={modelsLoading || running || Boolean(headerError)}>{modelsLoading ? "读取中" : "获取模型"}</Button>
            </div>
            <TextField label="模型名" value={prefs.model} onChange={(event) => patch({ model: event.target.value })} support="示例只是占位，以 /models 返回为准。" />
            <div className="cluster">
              {hints.slice(0, 8).map((model) => (
                <button key={model} type="button" className="md-chip" aria-pressed={prefs.model === model} onClick={() => patch({ model })}>{model}</button>
              ))}
              {models.length > 8 ? <button type="button" className="md-chip" onClick={() => setModelsOpen(true)}>全部 {models.length}</button> : null}
            </div>
            <Segmented
              label="思考强度"
              value={prefs.thinking}
              onChange={(thinkingLevel) => patch({ thinking: thinkingLevel as ThinkingLevel })}
              options={THINKING.map((item) => ({ value: item.id, label: item.label, title: item.hint }))}
            />
            <p className="field-support">
              {thinking?.hint}。OpenAI 映射为 {thinking?.openai}，Claude extended thinking 预算为 {thinking?.claude}。非推理模型请选关闭。
            </p>
            <Button variant="text" onClick={() => setPromptOpen(true)}>查看将发送的标准提示词</Button>
          </section>

          <div className="hide-mobile">
            <Button size="lg" onClick={() => void generate()} disabled={running || modelsLoading || Boolean(headerError)}>{running ? "生成中" : "开始生成"}</Button>
            {running ? <Button variant="text" onClick={() => abortRef.current?.abort()}>取消</Button> : null}
            <p className="field-support">Ctrl 或 ⌘ + Enter 也可以开始。</p>
          </div>
        </div>

        <div className="preview-sticky">
          <section className="md-card stage">
            <div className="cluster" style={{ justifyContent: "space-between" }}>
              <div>
                <p className="eyebrow">画面</p>
                <h2 className="h3">{result?.ok ? prefs.model : "等待模型交卷"}</h2>
              </div>
              <span className="md-chip">{running ? "请求中" : result ? (result.via === "proxy" ? "一次性中转" : "浏览器直连") : "尚未开始"}</span>
            </div>
            {running ? <LinearProgress label={`已等待 ${formatDuration(elapsed)}`} /> : null}
            {result?.error ? <div className="banner-error">{result.error}</div> : null}
            {result?.externalRefs.length ? (
              <div className="banner-error">检测到外部资源：{result.externalRefs.join("，")}。隔离预览会阻止加载。</div>
            ) : null}
            {result ? (
              <div className="metric-row">
                <div className="metric"><span>输入 Token</span><strong className="num">{formatTokens(result.usage.inputTokens)}</strong></div>
                <div className="metric"><span>输出 Token</span><strong className="num">{formatTokens(result.usage.outputTokens)}</strong></div>
                <div className="metric"><span>合计</span><strong className="num">{formatTokens(result.usage.totalTokens)}</strong></div>
                <div className="metric"><span>用时</span><strong className="num">{formatDuration(result.durationMs)}</strong></div>
              </div>
            ) : null}
            <div className="cluster">
              <span className="md-chip">{prefs.model || "未选模型"}</span>
              <span className="md-chip">思考 {thinking?.label}</span>
              {result?.fromFence ? <span className="md-chip">已去掉代码围栏</span> : null}
            </div>
            {result?.html ? (
              <>
                <div className="cluster">
                  <Button variant="outlined" icon={<IconCode />} onClick={() => setSourceOpen(true)}>源码</Button>
                  <Button variant="outlined" icon={<IconPrompt />} onClick={() => setPromptOpen(true)}>提示词</Button>
                  <Button variant="tonal" icon={<IconDownload />} onClick={() => downloadHtml(result.html || "", safeFilename(prefs.model || "pelican"))}>下载</Button>
                  <Button variant="text" onClick={() => openIsolated(result.html || "")}>隔离窗口</Button>
                </div>
                <PreviewFrame html={result.html} title="本次生成的鹈鹕动画" />
              </>
            ) : (
              <div className="empty-state">
                <img src="/images/hero-pelican.jpg" alt="" />
                <p className="muted">生成后会在这里直接渲染模型返回的 HTML。预览禁止外部网络，方便看出它有没有偷偷引用图片。</p>
                {result?.raw ? <Button variant="text" onClick={() => setRawOpen(true)}>查看原始响应</Button> : null}
              </div>
            )}
            {result?.html ? (
              <div className="stack">
                <h3 className="h3">人工判断</h3>
                <p className="field-support">勾选只保存在本机历史。公示时可以选择是否带上你的判断。</p>
                <div className="checklist">
                  {CHECKLIST.map((item) => (
                    <label key={item.id} className="check-item">
                      <input
                        type="checkbox"
                        checked={Boolean(checklist[item.id])}
                        onChange={(event) => {
                          const next = { ...checklist, [item.id]: event.target.checked };
                          setChecklist(next);
                          rememberChecklist(next);
                        }}
                      />
                      <span>{item.label}</span>
                    </label>
                  ))}
                </div>
                <Segmented label="主观判断" value={verdict} onChange={(value) => { setVerdict(value); rememberChecklist(checklist, value); }} options={VERDICTS.map((item) => ({ value: item.id, label: item.label }))} />
                {uploadedId ? <div className="banner-info">已公示。可以在公示页打开这条记录。</div> : (
                  <PublishForm
                    draft={{
                      html: result.html,
                      model: prefs.model.trim(),
                      protocol: prefs.protocol,
                      thinkingLevel: prefs.thinking,
                      baseUrl: prefs.baseUrl,
                      durationMs: result.durationMs,
                      inputTokens: result.usage.inputTokens,
                      outputTokens: result.usage.outputTokens,
                      totalTokens: result.usage.totalTokens,
                      via: result.via,
                      nickname: prefs.nickname,
                      verdict,
                      channel: prefs.channel,
                    }}
                    onPublished={(id) => {
                      setUploadedId(id);
                      if (historyId) {
                        const all = JSON.parse(localStorage.getItem("pb-history") || "[]") as HistoryItem[];
                        localStorage.setItem("pb-history", JSON.stringify(all.map((item) => item.id === historyId ? { ...item, uploadedId: id } : item)));
                      }
                    }}
                  />
                )}
              </div>
            ) : null}
          </section>
        </div>
      </div>
      <div className="bench-mobile-bar">
        {running ? <Button variant="outlined" onClick={() => abortRef.current?.abort()}>取消</Button> : null}
        <Button onClick={() => void generate()} disabled={running || modelsLoading || Boolean(headerError)} style={{ flex: 1 }}>{running ? "生成中" : "开始生成"}</Button>
      </div>

      <Dialog open={modelsOpen} title="选择模型" onClose={() => setModelsOpen(false)}>
        <TextField label="筛选" value={modelQuery} onChange={(event) => setModelQuery(event.target.value)} />
        <div className="model-list" style={{ marginTop: 12 }}>
          {filteredModels.map((model) => (
            <button key={model} type="button" aria-current={prefs.model === model} onClick={() => { patch({ model }); setModelsOpen(false); }}>{model}</button>
          ))}
          {filteredModels.length === 0 ? <p className="muted">没有匹配的模型。</p> : null}
        </div>
      </Dialog>
      <Dialog open={sourceOpen} title="生成源码" wide onClose={() => setSourceOpen(false)} footer={<Button variant="tonal" onClick={() => void copyText(result?.html || "").then(() => notify("源码已复制"))}>复制</Button>}>
        <pre className="code-view">{result?.html}</pre>
      </Dialog>
      <Dialog open={promptOpen} title="标准提示词" onClose={() => setPromptOpen(false)} footer={<Button variant="tonal" onClick={() => void copyText(STANDARD_PROMPT).then(() => notify("提示词已复制"))}>复制</Button>}>
        <p className="muted">为了让不同模型和渠道可以对照，提示词固定，不能在这里改。</p>
        <pre className="code-view">{STANDARD_PROMPT}</pre>
      </Dialog>
      <Dialog open={rawOpen} title="原始响应" wide onClose={() => setRawOpen(false)}>
        <pre className="code-view">{result?.raw.slice(0, 50000)}</pre>
      </Dialog>
    </div>
  );
}
