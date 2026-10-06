"use client";

import { useMemo } from "react";
import { withPreviewCsp } from "@/lib/extract";
import { cx } from "@/lib/format";

export function PreviewFrame({
  html,
  title,
  className,
  interactive = true,
}: {
  html: string;
  title?: string;
  className?: string;
  interactive?: boolean;
}) {
  const srcDoc = useMemo(() => withPreviewCsp(html), [html]);
  return (
    <iframe
      className={cx("preview-frame", className)}
      title={title || "鹈鹕骑车预览"}
      sandbox="allow-scripts"
      referrerPolicy="no-referrer"
      srcDoc={srcDoc}
      style={interactive ? undefined : { pointerEvents: "none" }}
    />
  );
}
