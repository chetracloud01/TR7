"use client";

import { THEME_PRESETS } from "@/lib/theme";
import { useTheme } from "@/lib/useTheme";

export function ThemeSwatches({ size = "sm" }: { size?: "sm" | "md" }) {
  const { theme, setTheme } = useTheme();
  const dims = size === "sm" ? "w-7 h-[18px]" : "w-10 h-6";

  return (
    <div className="flex gap-1.5">
      {THEME_PRESETS.map((preset) => (
        <button
          key={preset.id}
          type="button"
          onClick={() => setTheme(preset.id)}
          aria-label={`${preset.label} theme`}
          aria-pressed={theme === preset.id}
          title={preset.label}
          className={`${dims} flex rounded-[5px] overflow-hidden border-2 cursor-pointer p-0`}
          style={{ borderColor: theme === preset.id ? "var(--accent)" : "var(--border)" }}
        >
          <span className="flex-1" style={{ background: preset.swatch[0] }} />
          <span className="flex-1" style={{ background: preset.swatch[1] }} />
        </button>
      ))}
    </div>
  );
}
