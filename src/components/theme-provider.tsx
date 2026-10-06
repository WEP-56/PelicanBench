"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { applyAppearance, defaultAppearance, loadAppearance, saveAppearance, type Appearance } from "@/lib/appearance";

type AppearanceContextValue = {
  appearance: Appearance;
  ready: boolean;
  update: (patch: Partial<Appearance>) => void;
  reset: () => void;
};

const AppearanceContext = createContext<AppearanceContextValue | null>(null);
const SnackbarContext = createContext<{ notify: (message: string) => void }>({ notify: () => {} });

export function useAppearance() {
  const value = useContext(AppearanceContext);
  if (!value) throw new Error("ThemeProvider missing");
  return value;
}

export function useSnackbar() {
  return useContext(SnackbarContext);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [appearance, setAppearance] = useState<Appearance>(defaultAppearance);
  const [ready, setReady] = useState(false);
  const [snack, setSnack] = useState<string | null>(null);

  useEffect(() => {
    const loaded = loadAppearance();
    setAppearance(loaded);
    applyAppearance(loaded);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready || appearance.mode !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyAppearance(appearance);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [appearance, ready]);

  useEffect(() => {
    if (!snack) return;
    const timer = window.setTimeout(() => setSnack(null), 3200);
    return () => window.clearTimeout(timer);
  }, [snack]);

  const value = useMemo<AppearanceContextValue>(() => ({
    appearance,
    ready,
    update: (patch) => {
      const next = { ...appearance, ...patch };
      setAppearance(next);
      saveAppearance(next);
      applyAppearance(next);
    },
    reset: () => {
      setAppearance(defaultAppearance);
      saveAppearance(defaultAppearance);
      applyAppearance(defaultAppearance);
    },
  }), [appearance, ready]);

  return (
    <AppearanceContext.Provider value={value}>
      <SnackbarContext.Provider value={{ notify: setSnack }}>
        {children}
        {snack ? <div className="md-snackbar" role="status">{snack}</div> : null}
      </SnackbarContext.Provider>
    </AppearanceContext.Provider>
  );
}
