"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export function Tracker() {
  const pathname = usePathname();
  useEffect(() => {
    const hour = new Date().toISOString().slice(0, 13);
    const key = `pb-view:${pathname}:${hour}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    void fetch("/api/telemetry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: pathname, event: "pageview", referrer: document.referrer }),
    }).catch(() => undefined);
  }, [pathname]);
  return null;
}
