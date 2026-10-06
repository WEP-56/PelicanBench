"use client";

import { useState } from "react";
import { channelLabel, protocolLabel, thinkingLabel, verdictClass, verdictLabel } from "@/lib/constants";
import { findExternalRefs } from "@/lib/extract";
import { copyText, downloadHtml, formatDuration, formatTime, formatTokens, safeFilename, shortUrl } from "@/lib/format";
import type { PublicResult } from "@/lib/types";
import { IconCode, IconDownload, IconPrompt } from "./icons";
import { PreviewFrame } from "./preview";
import { useSnackbar } from "./theme-provider";
import { Button } from "./ui";

export function DetailView({ item }: { item: PublicResult }) {
  const [tab, setTab] = useState<"preview" | "source" | "prompt">("preview");
  const { notify } = useSnackbar();
  const refs = item.html ? findExternalRefs(item.html) : [];
  return (
    <div className="page stack">
      <div className="cluster">
        <h2 className="h2">{item.model}</h2>
        {item.verdict ? <span className={`md-chip ${verdictClass(item.verdict)}`}>{verdictLabel(item.verdict)}</span> : null}
        <span className="md-chip">{channelLabel(item.channel)}</span>
        <span className="md-chip">{protocolLabel(item.protocol)}</span>
        <span className="md-chip">思考 {thinkingLabel(item.thinkingLevel)}</span>
      </div>
      {item.channel === "third_party" && item.baseUrl ? <div className="url-banner">第三方渠道 · {shortUrl(item.baseUrl)}</div> : null}
      {item.hostMismatch ? <p className="field-support">提交者声明为官方渠道，但客户端标记了域名与官方不一致。地址未公开。</p> : null}
      <div className="metric-row">
        <div className="metric"><span>输入</span><strong className="num">{formatTokens(item.inputTokens)}</strong></div>
        <div className="metric"><span>输出</span><strong className="num">{formatTokens(item.outputTokens)}</strong></div>
        <div className="metric"><span>用时</span><strong className="num">{formatDuration(item.durationMs)}</strong></div>
        <div className="metric"><span>时间</span><strong className="num">{formatTime(item.createdAt)}</strong></div>
      </div>
      {item.note ? <p className="md-card-filled" style={{ margin: 0 }}>{item.note}</p> : null}
      {refs.length ? <div className="banner-error">源码里出现了外部地址。隔离预览会挡住它们，这通常说明没有遵守“禁止外部资源”。</div> : null}
      <div className="cluster">
        <Button variant={tab === "preview" ? "filled" : "outlined"} onClick={() => setTab("preview")}>预览</Button>
        <Button variant={tab === "source" ? "filled" : "outlined"} icon={<IconCode />} onClick={() => setTab("source")}>源码</Button>
        <Button variant={tab === "prompt" ? "filled" : "outlined"} icon={<IconPrompt />} onClick={() => setTab("prompt")}>提示词</Button>
        <Button variant="tonal" icon={<IconDownload />} onClick={() => downloadHtml(item.html, safeFilename(item.model))}>下载</Button>
        <Button variant="text" onClick={() => void copyText(window.location.href).then(() => notify("链接已复制"))}>复制链接</Button>
      </div>
      {tab === "preview" ? <PreviewFrame html={item.html} title={item.model} /> : null}
      {tab === "source" ? (
        <div className="stack">
          <div><Button variant="text" onClick={() => void copyText(item.html).then(() => notify("源码已复制"))}>复制源码</Button></div>
          <pre className="code-view">{item.html}</pre>
        </div>
      ) : null}
      {tab === "prompt" ? <pre className="code-view">{item.prompt}</pre> : null}
      <p className="field-support">预览在隔离框里运行，并禁止外部网络。下载的是提交时的原始 HTML。</p>
    </div>
  );
}
