"use client";

import { useState } from "react";
import Link from "next/link";
import type { Protocol } from "@/lib/constants";
import { BROWSER_HEADER_SOURCE, HEADER_PRESETS, HEADERS_RESEARCHED_AT, presetEntries } from "@/lib/header-presets";
import { EMPTY_HEADER_SETTINGS, MAX_CUSTOM_HEADERS, headerIsSensitive, headerPreview, inspectHeaders, type HeaderEntry, type HeaderSettings } from "@/lib/request-headers";
import { Button, Dialog, Switch, TextArea, TextField } from "./ui";
import "./header-editor.css";

export function HeaderEditor({ value, onChange, protocol, disabled }: {
  value: HeaderSettings;
  onChange: (value: HeaderSettings) => void;
  protocol: Protocol;
  disabled: boolean;
}) {
  const [showValues, setShowValues] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [json, setJson] = useState("");
  const [importError, setImportError] = useState("");
  const selected = HEADER_PRESETS.find((preset) => preset.id === value.preset);
  const checked = inspectHeaders(value.entries);
  const proxyRequired = checked.needsProxy && value.transport !== "proxy";
  let preview: Record<string, string> | null = null;
  try { preview = headerPreview(protocol, value); } catch { /* Inline field errors explain why. */ }

  function edit(id: string, patch: Partial<HeaderEntry>) {
    onChange({ ...value, entries: value.entries.map((row) => row.id === id ? { ...row, ...patch } : row) });
  }

  function importHeaders() {
    setImportError("");
    try {
      const parsed = JSON.parse(json) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("请提供 JSON 对象，例如 {\"X-Client\":\"pelicanbench\"}");
      const pairs = Object.entries(parsed);
      if (pairs.length > MAX_CUSTOM_HEADERS) throw new Error(`最多导入 ${MAX_CUSTOM_HEADERS} 项`);
      if (pairs.some(([, v]) => typeof v !== "string")) throw new Error("每个请求头的值都必须是字符串");
      const rows = pairs.map(([name, val]) => ({ id: crypto.randomUUID(), name, value: val as string, enabled: true }));
      const validation = inspectHeaders(rows);
      if (validation.errors.length) throw new Error(validation.errors[0].message);
      onChange({ ...value, preset: "custom", entries: rows });
      setImportOpen(false);
      setJson("");
    } catch (error) {
      setImportError(error instanceof SyntaxError ? "JSON 格式不正确，请检查引号、逗号与括号。" : error instanceof Error ? error.message : "导入失败");
    }
  }

  return (
    <details className="md-card header-config">
      <summary className="header-config-summary">
        <div>
          <h2 className="h3">请求头配置</h2>
          <p className="field-support">{selected?.label ?? "自定义"} · {checked.active.length} 项额外头 · {value.transport === "proxy" ? "一次性中转" : "浏览器优先"}</p>
        </div>
        <svg className="header-chevron" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </summary>
      <fieldset className="header-config-body stack" disabled={disabled}>
        <p className="field-support">仅作用于你填写的模型接口，包括获取模型与生成。请用于你有权使用、且服务商允许的客户端兼容场景。</p>
        <div className="header-preset-grid" role="group" aria-label="请求头预设">
          {HEADER_PRESETS.map((preset) => (
            <button
              type="button"
              key={preset.id}
              className="header-preset"
              aria-pressed={preset.id === value.preset}
              onClick={() => onChange({ ...value, preset: preset.id, entries: presetEntries(preset.id) })}
            >
              <strong>{preset.label}</strong>
              <span>{preset.hint}</span>
            </button>
          ))}
        </div>
        <p className="field-support">切换预设会替换条目，不会自动更改发送方式或协议。所有值均可编辑。</p>
        {selected && selected.id !== "default" ? (
          <div className="header-source-note">
            <div className="cluster"><span className="md-chip">{selected.version}</span><span className="field-support">建议：{selected.recommended}</span></div>
            <p>{selected.detail}</p>
            <div className="stack" style={{ gap: 6 }}>
              {selected.sources.map((source) => <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer">{source.title} ↗</a>)}
            </div>
            <p className="field-support">核验于 {HEADERS_RESEARCHED_AT} · 版本快照，不自动追踪 CLI 更新</p>
          </div>
        ) : null}

        {value.entries.length === 0 ? <div className="header-empty">尚未添加额外请求头，当前使用标准 API 请求。</div> : null}
        <div className="header-entry-list">
          {value.entries.map((row, index) => {
            const issue = checked.errors.find((error) => error.id === row.id)?.message;
            const sensitive = headerIsSensitive(row.name);
            return (
              <div className={`header-entry${row.enabled ? "" : " header-entry-off"}`} key={row.id}>
                <div className="cluster" style={{ justifyContent: "space-between" }}>
                  <label className="header-enable"><input type="checkbox" checked={row.enabled} onChange={(event) => edit(row.id, { enabled: event.target.checked })} aria-label={`启用请求头 ${index + 1}`} />请求头 {index + 1}</label>
                  <Button size="sm" variant="text" aria-label={`删除请求头 ${index + 1}`} onClick={() => onChange({ ...value, entries: value.entries.filter((entry) => entry.id !== row.id) })}>删除</Button>
                </div>
                <div className="header-row-fields">
                  <TextField label={`头名称 ${index + 1}`} value={row.name} onChange={(event) => edit(row.id, { name: event.target.value })} autoComplete="off" spellCheck={false} maxLength={128} />
                  <TextField label={`头值 ${index + 1}`} value={row.value} onChange={(event) => edit(row.id, { value: event.target.value })} type={sensitive && !showValues ? "password" : "text"} autoComplete="off" spellCheck={false} maxLength={4096} />
                </div>
                {issue ? <p className="field-error" role="alert">{issue}</p> : null}
                {row.enabled && sensitive ? <p className="field-support">敏感值只在当前页面使用，预览始终脱敏。</p> : null}
              </div>
            );
          })}
        </div>
        {checked.errors.filter((issue) => issue.id === "limit").map((issue) => <p className="field-error" role="alert" key={issue.message}>{issue.message}</p>)}
        <div className="cluster">
          <Button variant="tonal" size="sm" disabled={value.entries.length >= MAX_CUSTOM_HEADERS} onClick={() => onChange({ ...value, entries: [...value.entries, { id: crypto.randomUUID(), name: "", value: "", enabled: true }] })}>添加请求头</Button>
          <Button variant="text" size="sm" onClick={() => { setImportOpen(true); setImportError(""); }}>导入 JSON</Button>
          <Button variant="text" size="sm" onClick={() => { onChange({ ...EMPTY_HEADER_SETTINGS, entries: [] }); setShowValues(false); }}>恢复默认请求头</Button>
        </div>
        <Switch checked={showValues} onChange={setShowValues} label="显示敏感请求头值" />
        <p className="field-support">可用 {"{{API_KEY}}"} 引用上方密钥，例如 Bearer {"{{API_KEY}}"}。同名头覆盖协议默认值；Content-Type、Accept 和连接/安全头由应用管理。名称不区分大小写，重复项会报错。</p>

        <Switch checked={value.transport === "proxy"} onChange={(enabled) => onChange({ ...value, transport: enabled ? "proxy" : "auto" })} label="始终通过本站一次性中转" support="开启后，密钥和这些请求头会经过本站内存转发，不写入数据库或日志。关闭则浏览器优先。" />
        {proxyRequired ? (
          <div className="header-transport-warning" role="status">
            <strong>User-Agent 需要一次性中转</strong>
            <p>Chrome 等浏览器可能静默丢弃自定义 User-Agent。为避免“看似设置但没有发送”，请明确启用中转，或停用该项后直连。</p>
            <Button size="sm" variant="tonal" onClick={() => onChange({ ...value, transport: "proxy" })}>同意并启用一次性中转</Button>
            <a href={BROWSER_HEADER_SOURCE} target="_blank" rel="noopener noreferrer">浏览器限制说明 ↗</a>
          </div>
        ) : null}
        <details className="header-effective">
          <summary>查看生效请求头（已脱敏）</summary>
          <p className="field-support">仅列应用设置的头。浏览器或传输库仍可能追加自己的网络头。配置无效时不会发送请求。</p>
          <pre className="code-view">{preview ? JSON.stringify(preview, null, 2) : "请先修正上方的请求头错误。"}</pre>
        </details>
        <p className="field-support">这些是最小标识，不是完整客户端模拟，也不提供额外权限。网关仍可能检查请求体、认证方式或其他特征。<Link href="/docs#headers">查看配置说明</Link></p>
        <p className="field-support">配置仅留在页面内存，刷新或离开测试页后清除；不会随历史、公示或 HTML 下载保存。</p>
      </fieldset>
      <Dialog open={importOpen} title="导入请求头 JSON" onClose={() => setImportOpen(false)} footer={<Button disabled={disabled} onClick={importHeaders}>替换为导入内容</Button>}>
        <div className="stack">
          <p className="field-support">仅接受名称到字符串值的 JSON 对象。导入不会自动启用中转，也不会保存到本机存储。</p>
          <TextArea label="请求头 JSON" value={json} onChange={(event) => setJson(event.target.value)} spellCheck={false} maxLength={20_000} support={'例如：{"X-Client":"pelicanbench","Authorization":"Bearer {{API_KEY}}"}'} />
          {importError ? <p className="field-error" role="alert">{importError}</p> : null}
        </div>
      </Dialog>
    </details>
  );
}
