import type { ReactNode } from "react";

type IconProps = { active?: boolean; size?: number };

function Svg({ children, size = 24 }: { children: ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill="none">
      {children}
    </svg>
  );
}

export function IconHome({ active, size }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </Svg>
  );
}
export function IconLab({ active, size }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M9 3h6M10 3v5.2L5.8 16.4A4 4 0 0 0 9.3 22h5.4a4 4 0 0 0 3.5-5.6L14 8.2V3" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </Svg>
  );
}
export function IconGallery({ active, size }: IconProps) {
  return (
    <Svg size={size}>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" />
    </Svg>
  );
}
export function IconHistory({ active, size }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M4 12a8 8 0 1 0 2.2-5.5M4 4v4h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill={active ? "currentColor" : "none"} />
      <path d="M12 8v4.2l2.8 1.8" stroke={active ? "var(--md-surface-container-low)" : "currentColor"} strokeWidth="1.8" strokeLinecap="round" />
    </Svg>
  );
}
export function IconDocs({ active, size }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M7 3.5h7l4 4V20a1.5 1.5 0 0 1-1.5 1.5h-9.5A1.5 1.5 0 0 1 5.5 20V5A1.5 1.5 0 0 1 7 3.5Z" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" />
      <path d="M14 3.8V8h4.2M8 12h8M8 16h6" stroke={active ? "var(--md-surface-container-low)" : "currentColor"} strokeWidth="1.8" strokeLinecap="round" />
    </Svg>
  );
}
export function IconPalette({ active, size }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M12 3.5A8.5 8.5 0 1 0 16 19.2c.8-.5 1.2-1.4.8-2.3-.3-.7.1-1.4.8-1.6H18a2.5 2.5 0 0 0 2.5-2.5A8.4 8.4 0 0 0 12 3.5Z" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" />
      <circle cx="8" cy="10" r="1" fill="currentColor" />
      <circle cx="12" cy="8" r="1" fill="currentColor" />
      <circle cx="16" cy="10" r="1" fill="currentColor" />
    </Svg>
  );
}
export function IconMenu() {
  return <Svg><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></Svg>;
}
export function IconClose() {
  return <Svg><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></Svg>;
}
export function IconGithub() {
  return <Svg><path d="M12 .9a11.1 11.1 0 0 0-3.51 21.63c.55.1.76-.24.76-.54v-2.08c-3.1.68-3.76-1.32-3.76-1.32-.5-1.3-1.24-1.65-1.24-1.65-1.01-.69.08-.68.08-.68 1.12.08 1.7 1.15 1.7 1.15.99 1.69 2.6 1.2 3.23.91.1-.72.39-1.2.7-1.48-2.47-.28-5.07-1.24-5.07-5.53 0-1.22.44-2.22 1.15-3-.11-.28-.5-1.42.11-2.95 0 0 .94-.3 3.08 1.15a10.7 10.7 0 0 1 5.6 0c2.14-1.45 3.08-1.15 3.08-1.15.61 1.53.22 2.67.11 2.95.72.78 1.14 1.78 1.14 3.01 0 4.3-2.6 5.24-5.08 5.51.4.35.75 1.03.75 2.08v3.08c0 .3.2.65.77.54A11.1 11.1 0 0 0 12 .9Z" fill="currentColor" /></Svg>;
}
export function IconMoon() {
  return <Svg><path d="M16 3.5A8.2 8.2 0 1 0 20.5 14 6.5 6.5 0 0 1 16 3.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /></Svg>;
}
export function IconSun() {
  return <Svg><circle cx="12" cy="12" r="3.2" stroke="currentColor" strokeWidth="1.8" /><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></Svg>;
}
export function IconEye({ off = false }: { off?: boolean }) {
  return (
    <Svg>
      <path d="M2.8 12S6.2 6.5 12 6.5 21.2 12 21.2 12 17.8 17.5 12 17.5 2.8 12 2.8 12Z" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="2.4" stroke="currentColor" strokeWidth="1.8" />
      {off ? <path d="M5 5l14 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /> : null}
    </Svg>
  );
}
export function IconDownload() {
  return <Svg><path d="M12 4v10m0 0 4-4m-4 4-4-4M5 19h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></Svg>;
}
export function IconCode() {
  return <Svg><path d="m8 8-4 4 4 4M16 8l4 4-4 4M13 6l-2 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></Svg>;
}
export function IconPrompt() {
  return <Svg><path d="M5 6.5h14v9H8l-3 3v-12Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /><path d="M8 10h8M8 13h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></Svg>;
}
export function LogoMark({ size = 40 }: { size?: number }) {
  return (
    <img
      className="brand-mark"
      src="/icon.png"
      alt=""
      width={size}
      height={size}
    />
  );
}
