const PREVIEW_CSP = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; media-src data: blob:; connect-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'none';">`;

export function extractHtml(raw: string) {
  const original = raw.replace(/^\uFEFF/, "").trim();
  if (!original) return { html: null as string | null, fromFence: false, reason: "响应为空" };

  let fromFence = false;
  let text = original;
  const fence = text.match(/```(?:html|svg)?\s*([\s\S]*?)```/i);
  if (fence && /<(?:!DOCTYPE|html|svg)\b/i.test(fence[1])) {
    text = fence[1].trim();
    fromFence = true;
  }

  const start = text.search(/<!DOCTYPE\s+html|<html[\s>]|<svg[\s>]/i);
  if (start < 0) {
    return { html: null, fromFence, reason: "没有找到可运行的 HTML 或 SVG" };
  }

  let html = text.slice(start).trim().replace(/```\s*$/g, "").trim();
  if (/^<svg[\s>]/i.test(html) && !/<html[\s>]/i.test(html)) {
    html = `<!DOCTYPE html><html lang="zh"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>PelicanBench</title><style>html,body{margin:0;height:100%;background:#f4fbf8}svg{width:100%;height:100%;display:block}</style></head><body>${html}</body></html>`;
  }
  return { html, fromFence, reason: "ok" };
}

export function withPreviewCsp(html: string) {
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head[^>]*>/i, (match) => `${match}${PREVIEW_CSP}`);
  }
  return `<!DOCTYPE html><html><head><meta charset="utf-8">${PREVIEW_CSP}</head><body>${html}</body></html>`;
}

export function findExternalRefs(html: string) {
  const urls = new Set<string>();
  const attr = /\b(?:src|href)\s*=\s*["'](https?:\/\/[^"']+)["']/gi;
  const css = /url\(\s*["']?(https?:\/\/[^"')]+)["']?\s*\)/gi;
  for (const re of [attr, css]) {
    let match: RegExpExecArray | null;
    while ((match = re.exec(html))) urls.add(match[1]);
  }
  return [...urls].slice(0, 8);
}

export function openIsolated(html: string) {
  const blob = new Blob([withPreviewCsp(html)], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
