export type Seed = "teal" | "blue" | "violet" | "amber" | "green";

export type Appearance = {
  mode: "light" | "dark" | "system";
  seed: Seed;
  contrast: "standard" | "high";
  shape: "round" | "standard";
  density: "comfortable" | "compact";
  motion: "full" | "reduced";
};

export const APPEARANCE_KEY = "pb-appearance";

export const defaultAppearance: Appearance = {
  mode: "system",
  seed: "teal",
  contrast: "standard",
  shape: "round",
  density: "comfortable",
  motion: "full",
};

export const SEEDS: { id: Seed; label: string; hint: string }[] = [
  { id: "teal", label: "鹈鹕青", hint: "默认" },
  { id: "blue", label: "谷歌蓝", hint: "产品蓝" },
  { id: "violet", label: "罗兰紫", hint: "Material 原色" },
  { id: "amber", label: "赤陶", hint: "喙色" },
  { id: "green", label: "新绿", hint: "清爽" },
];

export function loadAppearance(): Appearance {
  if (typeof window === "undefined") return defaultAppearance;
  try {
    const raw = localStorage.getItem(APPEARANCE_KEY);
    if (!raw) return defaultAppearance;
    return { ...defaultAppearance, ...(JSON.parse(raw) as Partial<Appearance>) };
  } catch {
    return defaultAppearance;
  }
}

export function saveAppearance(value: Appearance) {
  localStorage.setItem(APPEARANCE_KEY, JSON.stringify(value));
}

export function resolveDark(mode: Appearance["mode"]) {
  if (mode === "dark") return true;
  if (mode === "light") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function applyAppearance(value: Appearance) {
  const root = document.documentElement;
  root.dataset.theme = resolveDark(value.mode) ? "dark" : "light";
  root.dataset.seed = value.seed;
  root.dataset.contrast = value.contrast;
  root.dataset.shape = value.shape;
  root.dataset.density = value.density;
  root.dataset.motion = value.motion;
}

export const THEME_BOOT = `(function(){try{var s=JSON.parse(localStorage.getItem(${JSON.stringify(APPEARANCE_KEY)})||"{}");var mode=s.mode||"system";var dark=mode==="dark"||(mode!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);var root=document.documentElement;root.dataset.theme=dark?"dark":"light";root.dataset.seed=s.seed||"teal";root.dataset.contrast=s.contrast||"standard";root.dataset.shape=s.shape||"round";root.dataset.density=s.density||"comfortable";root.dataset.motion=s.motion||(window.matchMedia("(prefers-reduced-motion: reduce)").matches?"reduced":"full");}catch(e){}})();`;
