"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeSwatches } from "./ThemeSwatches";

const NAV_ITEMS = [
  {
    href: "/chat",
    label: "Chat",
    icon: (c: string) => (
      <path d="M4 5h16v11H8l-4 4V5z" stroke={c} />
    ),
  },
  {
    href: "/predict",
    label: "Predict Football",
    icon: (c: string) => (
      <>
        <circle cx="12" cy="12" r="9" stroke={c} />
        <circle cx="12" cy="12" r="4.5" stroke={c} />
        <circle cx="12" cy="12" r="0.6" fill={c} stroke="none" />
      </>
    ),
  },
  {
    href: "/bankroll",
    label: "Bankroll",
    icon: (c: string) => (
      <>
        <rect x="3" y="6" width="18" height="13" rx="2.5" stroke={c} />
        <path d="M3 10h18" stroke={c} />
        <circle cx="16.5" cy="14" r="1.3" fill={c} stroke="none" />
      </>
    ),
  },
  {
    href: "/settings",
    label: "Settings",
    icon: (c: string) => (
      <>
        <circle cx="12" cy="12" r="3" stroke={c} />
        <path
          d="M19.4 13.5a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.04 1.56V19.5a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.04-1.56 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1.04H4.5a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 6.15 5.4a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34H10.6A1.7 1.7 0 0 0 11.64 0"
          stroke={c}
        />
      </>
    ),
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <div
      className="w-[240px] h-screen shrink-0 flex flex-col px-4 py-6 border-r sticky top-0"
      style={{ background: "var(--bg)", borderColor: "var(--border)" }}
    >
      <div className="flex items-center gap-2.5 px-2 pb-7">
        <div
          className="w-[30px] h-[30px] rounded-lg flex items-center justify-center shrink-0"
          style={{ background: "var(--accent)" }}
        >
          <span className="tr7-display text-[15px] font-bold" style={{ color: "var(--accent-contrast)" }}>
            7
          </span>
        </div>
        <div className="flex flex-col leading-tight">
          <span className="tr7-display text-[17px] font-bold" style={{ color: "var(--text)" }}>
            TR7
          </span>
          <span className="text-[10.5px] tracking-wider uppercase" style={{ color: "var(--text-3)" }}>
            Personal Ops
          </span>
        </div>
      </div>

      <nav className="flex flex-col gap-0.5">
        {NAV_ITEMS.map((item) => {
          const active = pathname.startsWith(item.href);
          const iconColor = active ? "var(--accent)" : "var(--text-3)";
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-sm font-medium"
              style={{
                background: active ? "var(--surface-2)" : "transparent",
                color: active ? "var(--text)" : "var(--text-2)",
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                {item.icon(iconColor)}
              </svg>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="flex-1" />

      <div className="flex flex-col gap-2.5 pt-4 border-t" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-2 px-2">
          <span className="w-[7px] h-[7px] rounded-full shrink-0" style={{ background: "var(--positive)" }} />
          <span className="text-xs" style={{ color: "var(--text-2)" }}>4 of 6 providers connected</span>
        </div>

        <div className="flex flex-col gap-1.5 px-2">
          <span className="text-[10px] tracking-wider uppercase" style={{ color: "var(--text-3)" }}>Theme</span>
          <ThemeSwatches />
        </div>

        <div className="flex items-center gap-2.5 p-2.5 rounded-[10px]" style={{ background: "var(--surface)" }}>
          <div
            className="w-7 h-7 rounded-full border flex items-center justify-center shrink-0"
            style={{ background: "var(--surface-2)", borderColor: "var(--border-2)" }}
          >
            <span className="tr7-mono text-[11px]" style={{ color: "var(--text-2)" }}>YOU</span>
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-[12.5px] font-medium" style={{ color: "var(--text)" }}>Personal account</span>
            <span className="text-[11px]" style={{ color: "var(--text-3)" }}>Single-user mode</span>
          </div>
        </div>
      </div>
    </div>
  );
}
