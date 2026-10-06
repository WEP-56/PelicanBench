"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { THINKING } from "@/lib/constants";
import type { PublicResult } from "@/lib/types";
import { ResultCard } from "./result-card";
import { Button, TextField } from "./ui";

type Payload = { items: PublicResult[]; total: number; page: number; pageSize: number };

export function GalleryView() {
  const params = useSearchParams();
  const router = useRouter();
  const [data, setData] = useState<Payload | null>(null);
  const [references, setReferences] = useState<PublicResult[]>([]);
  const [error, setError] = useState("");
  const q = params.get("q") ?? "";
  const channel = params.get("channel") ?? "all";
  const protocol = params.get("protocol") ?? "all";
  const thinking = params.get("thinking") ?? "all";
  const sort = params.get("sort") ?? "new";
  const page = Number(params.get("page") ?? "1") || 1;

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (!value || value === "all" || (key === "page" && value === "1")) next.delete(key);
    else next.set(key, value);
    if (key !== "page") next.delete("page");
    router.replace(next.size ? `/gallery?${next}` : "/gallery");
  }

  useEffect(() => {
    const query = new URLSearchParams({ kind: "submission", page: String(page), sort });
    if (q) query.set("q", q);
    if (channel !== "all") query.set("channel", channel);
    if (protocol !== "all") query.set("protocol", protocol);
    if (thinking !== "all") query.set("thinking", thinking);
    let cancelled = false;
    void fetch(`/api/results?${query}`).then(async (response) => {
      const body = (await response.json()) as Payload & { error?: string };
      if (cancelled) return;
      if (!response.ok) setError(body.error || "公示读取失败");
      else {
        setError("");
        setData(body);
      }
    }).catch(() => { if (!cancelled) setError("公示读取失败"); });
    return () => { cancelled = true; };
  }, [q, channel, protocol, thinking, sort, page]);

  useEffect(() => {
    void fetch("/api/results?kind=reference&pageSize=6").then(async (response) => {
      if (!response.ok) return;
      const body = (await response.json()) as Payload;
      setReferences(body.items);
    }).catch(() => undefined);
  }, []);

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  return (
    <div className="page stack">
      <div>
        <p className="eyebrow">公示</p>
        <h2 className="h1">把画面放在明处</h2>
        <p className="lede">第三方渠道会展示提交者确认过的 Base URL，方便社区认出中转站。官方渠道只保留声明，不公开地址。</p>
      </div>
      <section className="md-card stack">
        <TextField label="搜索模型、昵称或地址" value={q} onChange={(event) => setParam("q", event.target.value)} />
        <div className="cluster">
          {[
            ["all", "全部渠道"],
            ["official", "官方"],
            ["third_party", "第三方"],
          ].map(([value, label]) => (
            <button key={value} type="button" className="md-chip" aria-pressed={channel === value} onClick={() => setParam("channel", value)}>{label}</button>
          ))}
          {[
            ["all", "全部协议"],
            ["openai-chat", "Chat"],
            ["openai-responses", "Responses"],
            ["anthropic", "Claude"],
          ].map(([value, label]) => (
            <button key={value} type="button" className="md-chip" aria-pressed={protocol === value} onClick={() => setParam("protocol", value)}>{label}</button>
          ))}
          <button type="button" className="md-chip" aria-pressed={thinking === "all"} onClick={() => setParam("thinking", "all")}>全部强度</button>
          {THINKING.map((item) => (
            <button key={item.id} type="button" className="md-chip" aria-pressed={thinking === item.id} onClick={() => setParam("thinking", item.id)}>{item.label}</button>
          ))}
          <button type="button" className="md-chip" aria-pressed={sort === "new"} onClick={() => setParam("sort", "new")}>最新</button>
          <button type="button" className="md-chip" aria-pressed={sort === "duration"} onClick={() => setParam("sort", "duration")}>耗时</button>
          <button type="button" className="md-chip" aria-pressed={sort === "tokens"} onClick={() => setParam("sort", "tokens")}>Token</button>
        </div>
      </section>
      {error ? <div className="banner-error">{error}</div> : null}
      {!data ? <div className="skeleton" style={{ height: 220 }} /> : data.items.length === 0 ? (
        <div className="md-card empty-state">
          <img src="/images/empty-bench.jpg" alt="" />
          <h3 className="h3">这个筛选下还没有公示</h3>
          <p className="muted">测试完成之后，可以自己决定要不要成为第一条。</p>
        </div>
      ) : (
        <>
          <div className="card-grid">{data.items.map((item) => <ResultCard key={item.id} item={item} />)}</div>
          <div className="pager">
            <span className="muted">{data.total} 条</span>
            <div className="cluster">
              <Button variant="outlined" disabled={page <= 1} onClick={() => setParam("page", String(page - 1))}>上一页</Button>
              <span className="muted">{page} / {pages}</span>
              <Button variant="outlined" disabled={page >= pages} onClick={() => setParam("page", String(page + 1))}>下一页</Button>
            </div>
          </div>
        </>
      )}
      {references.length ? (
        <section>
          <div className="section-head">
            <h2 className="h2">视觉基准</h2>
          </div>
          <div className="card-grid">{references.map((item) => <ResultCard key={item.id} item={item} />)}</div>
        </section>
      ) : null}
    </div>
  );
}
