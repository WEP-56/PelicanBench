import Link from "next/link";
import { channelLabel, protocolLabel, thinkingLabel, verdictClass, verdictLabel } from "@/lib/constants";
import { formatDuration, formatTime, formatTokens, shortUrl } from "@/lib/format";
import type { PublicResult } from "@/lib/types";
import { PreviewFrame } from "./preview";

export function ResultCard({ item }: { item: PublicResult }) {
  return (
    <Link href={`/gallery/${item.id}`} className="result-card">
      <div className="thumb">
        {item.html ? <PreviewFrame html={item.html} title={`${item.model} 的动画`} interactive={false} /> : null}
      </div>
      <div className="result-body">
        <div className="cluster">
          <h3>{item.model}</h3>
          {item.verdict ? <span className={`md-chip ${verdictClass(item.verdict)}`}>{verdictLabel(item.verdict)}</span> : null}
        </div>
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>
          {protocolLabel(item.protocol)} · 思考 {thinkingLabel(item.thinkingLevel)}
          {item.nickname ? ` · ${item.nickname}` : ""}
        </p>
        {item.channel === "third_party" && item.baseUrl ? (
          <div className="url-banner">第三方渠道 · {shortUrl(item.baseUrl)}</div>
        ) : (
          <span className="md-chip">{channelLabel(item.channel)}</span>
        )}
        <p className="muted" style={{ margin: 0, fontSize: 12 }}>
          {item.kind === "reference" ? "结构对照，不是模型成绩" : `${formatDuration(item.durationMs)} · ${formatTokens(item.totalTokens)} tokens`}
          {" · "}
          {formatTime(item.createdAt)}
        </p>
      </div>
    </Link>
  );
}
