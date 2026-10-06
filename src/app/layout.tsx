import type { Metadata } from "next";
import type { ReactNode } from "react";
import { headers } from "next/headers";
import { THEME_BOOT } from "@/lib/appearance";
import { ThemeProvider } from "@/components/theme-provider";
import { Tracker } from "@/components/tracker";
import { findActiveBan } from "@/server/bans";
import { ipFromGetter } from "@/server/http";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "PelicanBench", template: "%s · PelicanBench" },
  description: "社区视觉基准：让模型用内联 SVG 绘制鹈鹕骑自行车，人工判断外形与动态是否像模型真身。",
  applicationName: "PelicanBench",
  icons: { icon: "/icon.png", apple: "/icon.png" },
};

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: ReactNode }) {
  let banned = false;
  let reason: string | null = null;
  try {
    const headerList = await headers();
    const ban = await findActiveBan(ipFromGetter((name) => headerList.get(name)));
    if (ban) {
      banned = true;
      reason = ban.reason;
    }
  } catch {
    banned = false;
  }

  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&family=Noto+Sans+SC:wght@400;500;700&display=swap" rel="stylesheet" />
      </head>
      <body>
        <ThemeProvider>
          {banned ? <BannedScreen reason={reason} /> : (<><Tracker />{children}</>)}
        </ThemeProvider>
      </body>
    </html>
  );
}

function BannedScreen({ reason }: { reason: string | null }) {
  return (
    <main className="center-screen">
      <section className="md-card login-card stack">
        <p className="eyebrow">访问受限</p>
        <h1 className="h2">此网络地址已被限制访问 PelicanBench</h1>
        <p className="muted">{reason || "如果这是误封，请联系站点维护者。"}</p>
      </section>
    </main>
  );
}
