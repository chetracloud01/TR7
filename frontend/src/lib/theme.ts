export type ThemePreset = "warm" | "neon" | "editorial" | "calm";

export const THEME_PRESETS: { id: ThemePreset; label: string; swatch: [string, string] }[] = [
  { id: "warm", label: "Warm Terminal", swatch: ["#16120D", "#C9A227"] },
  { id: "neon", label: "Neon Pitch", swatch: ["#0A0D0C", "#9FFF3D"] },
  { id: "editorial", label: "Editorial", swatch: ["#FAF7F0", "#1F3A5F"] },
  { id: "calm", label: "Calm Minimal", swatch: ["#F5F2EC", "#6B8F71"] },
];

export const DEFAULT_THEME: ThemePreset = "warm";
const STORAGE_KEY = "tr7-theme";

export function getStoredTheme(): ThemePreset {
  if (typeof window === "undefined") return DEFAULT_THEME;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return (THEME_PRESETS.some((t) => t.id === stored) ? stored : DEFAULT_THEME) as ThemePreset;
}

export function applyTheme(theme: ThemePreset) {
  document.documentElement.setAttribute("data-theme", theme);
  window.localStorage.setItem(STORAGE_KEY, theme);
}

/** Inline script string, run before hydration in <head> to avoid a
 * flash of the default theme when a returning visitor has a saved
 * preference. */
export const THEME_INIT_SCRIPT = `
(function () {
  try {
    var t = localStorage.getItem('${STORAGE_KEY}');
    if (t) document.documentElement.setAttribute('data-theme', t);
  } catch (e) {}
})();
`;
