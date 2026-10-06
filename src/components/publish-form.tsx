"use client";

import { useState } from "react";
import { requestJson } from "@/lib/api-client";
import { STANDARD_PROMPT, VERDICTS } from "@/lib/constants";
import { isOfficialHost, resolveBase } from "@/lib/endpoints";
import { shortUrl } from "@/lib/format";
import { Button, Segmented, Switch, TextArea, TextField } from "./ui";
import { useSnackbar } from "./theme-provider";

export type PublishDraft = {
  html: string;
  model: string;
  protocol: string;
  thinkingLevel: string;
  baseUrl: string;
  durationMs: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  via: string | null;
  nickname?: string;
  note?: string;
  verdict?: string;
  channel?: "official" | "third_party";
};

export function PublishForm({ draft, onPublished }: { draft: PublishDraft; onPublished: (id: string) => void }) {
  const { notify } = useSnackbar();
  const [enabled, setEnabled] = useState(false);
  const [channel, setChannel] = useState<"official" | "third_party">(draft.channel ?? "official");
  const [nickname, setNickname] = useState(draft.nickname ?? "");
  const [note, setNote] = useState(draft.note ?? "");
  const [verdict, setVerdict] = useState(draft.verdict ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const resolved = resolveBase(draft.baseUrl, false);
  const publicUrl = "href" in resolved ? resolved.href : "";
  const mismatch = channel === "official" && !isOfficialHost(draft.baseUrl);

  async function submit() {
    if (busy) return;
    if (channel === "third_party" && !publicUrl) {
      setError("第三方渠道需要一个可公开的 Base URL");
      return;
    }
    setError("");
    setBusy(true);
    try {
      // Keep the payload explicit: the API key is never part of a submission.
      const data = await requestJson<{ id: string }>("/api/results", {
        method: "POST",
        body: JSON.stringify({
          html: draft.html,
          model: draft.model,
          protocol: draft.protocol,
          thinkingLevel: draft.thinkingLevel,
          durationMs: draft.durationMs,
          inputTokens: draft.inputTokens,
          outputTokens: draft.outputTokens,
          totalTokens: draft.totalTokens,
          via: draft.via,
          channel,
          baseUrl: channel === "third_party" ? publicUrl : "",
          nickname,
          note,
          verdict,
          hostMismatch: mismatch,
          prompt: STANDARD_PROMPT,
          website: "",
        }),
      });
      if (!data.id) throw new Error("后端未返回公示编号，请稍后重试");
      notify("已公示");
      onPublished(data.id);
      setEnabled(false);
    } catch (error) {
      setError(error instanceof Error ? error.message : "公示失败，请稍后重试");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <Switch checked={enabled} onChange={setEnabled} label="公示这条结果" support="关闭时只留在本机历史。打开后才会出现渠道选项。" />
      {enabled ? (
        <div className="stack">
          <Segmented
            label="渠道"
            value={channel}
            onChange={setChannel}
            options={[
              { value: "official", label: "官方渠道" },
              { value: "third_party", label: "第三方" },
            ]}
          />
          {channel === "third_party" ? (
            <div className="url-banner">
              公示时将展示去掉账号、查询参数后的地址：{publicUrl ? shortUrl(publicUrl) : "地址无效"}
            </div>
          ) : (
            <p className="field-support">官方渠道不展示 Base URL。渠道由你声明，站点不会向 OpenAI 核对。</p>
          )}
          {mismatch ? <p className="field-error">当前地址不是 api.openai.com 或 api.anthropic.com。仍可声明官方，管理端只会看到“域名不一致”标记，不会公开地址。</p> : null}
          <TextField label="昵称，可空" value={nickname} maxLength={24} onChange={(event) => setNickname(event.target.value)} support="留空则显示为匿名测试者" />
          <TextArea label="备注，可空" value={note} maxLength={280} onChange={(event) => setNote(event.target.value)} support="最多 280 字，不要写密钥" />
          <Segmented
            label="你的判断"
            value={verdict}
            onChange={setVerdict}
            options={VERDICTS.map((item) => ({ value: item.id, label: item.label }))}
          />
          {error ? <div className="banner-error" role="alert">{error}<p style={{ margin: "8px 0 0", fontSize: 13 }}>本次结果仍在本机历史中，不会因上传失败而丢失。可以稍后重新公示。</p></div> : null}
          <div>
            <Button onClick={() => void submit()} disabled={busy}>{busy ? "提交中" : error ? "重新公示" : "确认公示"}</Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
