"use client";

import { useSyncExternalStore } from "react";
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

export function setGlobalTheme(theme: ThemePreset) {
  current = theme;
  applyTheme(theme);
  listeners.forEach((l) => l());
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return { theme, setTheme: setGlobalTheme };
}
