"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { protocolLabel, thinkingLabel, verdictLabel } from "@/lib/constants";
import { downloadHtml, formatDuration, formatTime, formatTokens, safeFilename, shortUrl } from "@/lib/format";
import { clearHistory, loadHistory, saveHistory, type HistoryItem } from "@/lib/storage";
import { PreviewFrame } from "./preview";
import { PublishForm } from "./publish-form";
import { useSnackbar } from "./theme-provider";
import { Button, Dialog } from "./ui";

export function HistoryView() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [ready, setReady] = useState(false);
  const [active, setActive] = useState<HistoryItem | null>(null);
  const { notify } = useSnackbar();

  useEffect(() => {
    setItems(loadHistory());
    setReady(true);
  }, []);

  function remove(id: string) {
    const next = items.filter((item) => item.id !== id);
    setItems(next);
    saveHistory(next);
    if (active?.id === id) setActive(null);
  }

  if (!ready) return <div className="page"><div className="skeleton" style={{ height: 180 }} /></div>;

  return (
    <div className="page stack">
      <div className="section-head">
        <div>
          <p className="eyebrow">本机</p>
          <h2 className="h1">历史只在这台浏览器</h2>
          <p className="lede">这里保存你自己跑过的结果，包括失败记录。换浏览器、清站点数据，就会消失。密钥不会出现在这里。</p>
        </div>
        {items.length ? <Button variant="outlined" onClick={() => { clearHistory(); setItems([]); notify("历史已清除"); }}>清空</Button> : null}
      </div>
      {items.length === 0 ? (
        <div className="md-card empty-state">
          <img src="/images/empty-bench.jpg" alt="" />
          <h3 className="h3">还没有本地记录</h3>
          <Link className="md-btn md-btn-filled" href="/test">开始一次测试</Link>
        </div>
      ) : (
        <div className="stack">
          {items.map((item) => (
            <button key={item.id} type="button" className="md-card" style={{ textAlign: "left", cursor: "pointer" }} onClick={() => setActive(item)}>
              <div className="cluster" style={{ justifyContent: "space-between" }}>
                <strong>{item.model}</strong>
                <span className="muted">{formatTime(item.createdAt)}</span>
              </div>
              <p className="muted" style={{ marginBottom: 0 }}>
                {protocolLabel(item.protocol)} · 思考 {thinkingLabel(item.thinkingLevel)} · {formatDuration(item.durationMs)} · {formatTokens(item.totalTokens)}
                {item.ok ? "" : " · 失败"}
                {item.uploadedId ? " · 已公示" : ""}
              </p>
            </button>
          ))}
        </div>
      )}
      <Dialog open={Boolean(active)} title={active?.model || "记录"} wide onClose={() => setActive(null)}>
        {active ? (
          <div className="stack">
            <p className="muted">{protocolLabel(active.protocol)} · 思考 {thinkingLabel(active.thinkingLevel)} · {active.via === "proxy" ? "一次性中转" : "浏览器直连"} · {shortUrl(active.baseUrl)}</p>
            {active.error ? <div className="banner-error">{active.error}</div> : null}
            <div className="metric-row">
              <div className="metric"><span>输入</span><strong>{formatTokens(active.inputTokens)}</strong></div>
              <div className="metric"><span>输出</span><strong>{formatTokens(active.outputTokens)}</strong></div>
              <div className="metric"><span>用时</span><strong>{formatDuration(active.durationMs)}</strong></div>
              <div className="metric"><span>判断</span><strong>{verdictLabel(active.verdict)}</strong></div>
            </div>
            {active.html ? <PreviewFrame html={active.html} title={active.model} /> : active.rawPreview ? <pre className="code-view">{active.rawPreview}</pre> : null}
            <div className="cluster">
              {active.html ? <Button variant="tonal" onClick={() => downloadHtml(active.html || "", safeFilename(active.model))}>下载</Button> : null}
              <Button variant="outlined" onClick={() => remove(active.id)}>删除这条</Button>
              {active.uploadedId ? <Link className="md-btn md-btn-text" href={`/gallery/${active.uploadedId}`}>查看公示</Link> : null}
            </div>
            {active.html && !active.uploadedId ? (
              <PublishForm
                draft={{
                  html: active.html,
                  model: active.model,
                  protocol: active.protocol,
                  thinkingLevel: active.thinkingLevel,
                  baseUrl: active.baseUrl,
                  durationMs: active.durationMs,
                  inputTokens: active.inputTokens,
                  outputTokens: active.outputTokens,
                  totalTokens: active.totalTokens,
                  via: active.via,
                  verdict: active.verdict,
                  note: active.note,
                  channel: active.channelPref,
                }}
                onPublished={(id) => {
                  const next = loadHistory().map((item) => item.id === active.id ? { ...item, uploadedId: id } : item);
                  saveHistory(next);
                  setItems(next);
                  setActive({ ...active, uploadedId: id });
                }}
              />
            ) : null}
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}
