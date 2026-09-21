"use client";

import { useSyncExternalStore } from "react";
import { api } from "./api";
import { applyTheme, DEFAULT_THEME, getStoredTheme, ThemePreset } from "./theme";

let current: ThemePreset = DEFAULT_THEME;
let hydrated = false;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): ThemePreset {
  if (!hydrated && typeof window !== "undefined") {
    current = getStoredTheme();
    hydrated = true;
  }
  return current;
}

function getServerSnapshot(): ThemePreset {
  return DEFAULT_THEME;
}

export function setGlobalTheme(theme: ThemePreset, opts: { sync?: boolean } = {}) {
  current = theme;
  applyTheme(theme);
  listeners.forEach((l) => l());
  // Best-effort — a logged-out visitor (e.g. the /login page itself) or a
  // flaky request shouldn't block the local theme switch.
  if (opts.sync !== false) {
    api.put("/preferences", { theme_preset: theme }).catch(() => {});
  }
}

let reconciledFromServer = false;

/** Pulls the signed-in user's saved theme once per session and applies it
 * if it differs from what's cached in localStorage — keeps the choice
 * consistent across devices/browsers without blocking the instant local
 * paint that localStorage already gives on every load. */
export function reconcileThemeFromServer() {
  if (reconciledFromServer) return;
  reconciledFromServer = true;
  api
    .get<{ theme_preset: string; mode: string }>("/preferences")
    .then((prefs) => {
      if (prefs.theme_preset && prefs.theme_preset !== getSnapshot()) {
        setGlobalTheme(prefs.theme_preset as ThemePreset, { sync: false });
      }
    })
    .catch(() => {});
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return { theme, setTheme: (t: ThemePreset) => setGlobalTheme(t) };
}
