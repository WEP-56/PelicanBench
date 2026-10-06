"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { IconClose, IconDocs, IconGallery, IconGithub, IconHistory, IconHome, IconLab, IconMenu, IconMoon, IconPalette, IconSun, LogoMark } from "./icons";
import { useAppearance } from "./theme-provider";

const NAV = [
  { href: "/", label: "首页", icon: IconHome, exact: true },
  { href: "/test", label: "测试", icon: IconLab },
  { href: "/gallery", label: "公示", icon: IconGallery },
  { href: "/history", label: "历史", icon: IconHistory },
  { href: "/docs", label: "文档", icon: IconDocs },
  { href: "/settings", label: "外观", icon: IconPalette },
];

const TITLES: Record<string, string> = {
  "/": "首页",
  "/test": "测试",
  "/gallery": "公示",
  "/history": "历史",
  "/docs": "文档",
  "/settings": "外观",
};

const COLLAPSED_KEY = "pb-navigation-collapsed";
const MOBILE_QUERY = "(max-width: 980px)";

export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const { appearance, update } = useAppearance();
  const [dark, setDark] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const title = pathname.startsWith("/gallery/") ? "公示详情" : TITLES[pathname] ?? "PelicanBench";

  useEffect(() => {
    const media = window.matchMedia(MOBILE_QUERY);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- synchronize the responsive navigation with the browser viewport.
    setIsMobile(media.matches);
    try {
      setCollapsed(localStorage.getItem(COLLAPSED_KEY) === "true");
    } catch {
      // Navigation still works when browser storage is unavailable.
    }
    const onResize = () => {
      setIsMobile(media.matches);
      setMobileOpen(false);
    };
    media.addEventListener("change", onResize);
    return () => media.removeEventListener("change", onResize);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- close the drawer after route navigation.
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => setDark(appearance.mode === "dark" || (appearance.mode === "system" && media.matches));
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, [appearance.mode]);

  useEffect(() => {
    if (!isMobile || !mobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => {
      drawerRef.current?.querySelector<HTMLElement>('[aria-current="page"]')?.focus();
    }, 0);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setMobileOpen(false);
      }
      if (event.key !== "Tab") return;
      const focusable = drawerRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])');
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    const toggleButton = toggleRef.current;
    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
      toggleButton?.focus();
    };
  }, [isMobile, mobileOpen]);

  function toggleNavigation() {
    if (isMobile) {
      setMobileOpen((current) => !current);
      return;
    }
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem(COLLAPSED_KEY, String(next));
    } catch {
      // Remembering this preference is optional.
    }
  }

  const toggleLabel = isMobile
    ? mobileOpen ? "关闭导航" : "打开导航"
    : collapsed ? "展开侧边栏" : "收起侧边栏";
  const drawerClass = ["nav-drawer", mobileOpen ? "open" : "", !isMobile && collapsed ? "collapsed" : ""].filter(Boolean).join(" ");

  return (
    <div className="app-shell">
      <a className="skip-link" href="#content">跳到内容</a>
      {isMobile && mobileOpen ? <button className="nav-scrim" aria-label="关闭导航遮罩" onClick={() => setMobileOpen(false)} /> : null}
      <aside
        ref={drawerRef}
        id="primary-navigation"
        className={drawerClass}
        inert={isMobile && !mobileOpen}
        aria-hidden={isMobile && !mobileOpen ? true : undefined}
        role={isMobile && mobileOpen ? "dialog" : undefined}
        aria-modal={isMobile && mobileOpen ? true : undefined}
        aria-label="主导航"
      >
        <div className="drawer-head">
          <Link href="/" className="brand" aria-label="PelicanBench 首页" onClick={() => setMobileOpen(false)}>
            <LogoMark />
            <div className="brand-copy">
              <strong>PelicanBench</strong>
              <span>鹈鹕骑车基准</span>
            </div>
          </Link>
        </div>
        <nav className="nav-list" aria-label="主导航链接">
          {NAV.map((item) => {
            const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} className="nav-item" title={item.label} aria-current={active ? "page" : undefined} onClick={() => setMobileOpen(false)}>
                <Icon active={active} />
                <span className="nav-label">{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="drawer-foot">
          密钥不入库。
          <br />
          公示只在你确认之后发生。
        </div>
      </aside>
      <div className="shell-main">
        <header className="topbar">
          <button
            ref={toggleRef}
            className="md-btn md-btn-text md-icon-btn menu-btn"
            type="button"
            aria-label={toggleLabel}
            title={toggleLabel}
            aria-controls="primary-navigation"
            aria-expanded={isMobile ? mobileOpen : !collapsed}
            onClick={toggleNavigation}
          >
            {isMobile && mobileOpen ? <IconClose /> : <IconMenu />}
          </button>
          <h1>{title}</h1>
          <div className="topbar-spacer" />
          <a
            className="md-btn md-btn-text md-icon-btn"
            href="https://github.com/WEP-56/PelicanBench"
            target="_blank"
            rel="noreferrer"
            aria-label="在 GitHub 查看 PelicanBench 项目"
            title="GitHub 项目"
          >
            <IconGithub />
          </a>
          <button
            className="md-btn md-btn-text md-icon-btn"
            type="button"
            aria-label={dark ? "切换到浅色" : "切换到深色"}
            onClick={() => update({ mode: dark ? "light" : "dark" })}
          >
            {dark ? <IconSun /> : <IconMoon />}
          </button>
        </header>
        <main className="content-pane">
          <div id="content" key={pathname} className="page-enter">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
