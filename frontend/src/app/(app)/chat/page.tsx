"use client";

import { useState } from "react";

const SESSIONS = [
  { group: "Football prediction", title: "Man City vs Arsenal check", snippet: "Compare the tipster call against...", time: "2 min ago", active: true },
  { group: "Football prediction", title: "Liverpool set piece trends", snippet: "What does the data say about...", time: "Yesterday", active: false },
  { group: "General", title: "Staking plan sanity check", snippet: "Is 2% of bankroll too aggressive...", time: "3 days ago", active: false },
];

const MESSAGES = [
  { role: "user" as const, text: "Here's a screenshot of a tipster's call for City vs Arsenal — how does it compare to your own read?" },
  {
    role: "assistant" as const,
    text: "Their call: City to win at 1.85, medium confidence. My model has City at 78% (vs. their implied 54%) — mostly driven by Arsenal's centre-back injuries. Agreement is directional, but I'm notably more confident. I'd size this as modest value rather than a strong edge.",
    model: "Claude Opus 5 · reasoning · 1.2s",
  },
  { role: "user" as const, text: "What stake does that suggest under my Kelly plan?" },
  {
    role: "assistant" as const,
    text: "About $42, or 2.1% of your current bankroll — sent to your bet slip.",
    model: "Claude Haiku 4.5 · fast · streaming",
  },
];

export default function ChatPage() {
  const [draft, setDraft] = useState("");

  return (
    <div className="flex h-screen overflow-hidden">
      <div className="w-[280px] shrink-0 border-r flex flex-col py-6" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center justify-between px-5 pb-4">
          <span className="text-[13px] font-semibold">Conversations</span>
          <button
            aria-label="New chat"
            className="w-[26px] h-[26px] rounded-lg border flex items-center justify-center cursor-pointer"
            style={{ background: "var(--surface-2)", borderColor: "var(--border-2)" }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text)" strokeWidth="2.2" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </div>

        <div className="px-5 pb-4">
          <div className="flex items-center gap-2 rounded-[10px] border px-3 py-2.5" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.3-4.3" />
            </svg>
            <span className="text-[12.5px]" style={{ color: "var(--text-3)" }}>Search conversations</span>
          </div>
        </div>

        {["Football prediction", "General"].map((group) => (
          <div key={group}>
            <div className="px-5 pt-3 pb-1.5">
              <span className="text-[10.5px] tracking-wider uppercase" style={{ color: "var(--text-3)" }}>{group}</span>
            </div>
            <div className="flex flex-col px-3">
              {SESSIONS.filter((s) => s.group === group).map((s) => (
                <div
                  key={s.title}
                  className="flex flex-col gap-0.5 px-2 py-2.5 rounded-[10px]"
                  style={{ background: s.active ? "var(--surface)" : "transparent", border: s.active ? "1px solid var(--border)" : "1px solid transparent" }}
                >
                  <span className="text-[13px] font-medium" style={{ color: s.active ? "var(--text)" : "var(--text-2)" }}>{s.title}</span>
                  <span className="text-[11.5px] truncate" style={{ color: "var(--text-3)" }}>{s.snippet}</span>
                  <span className="tr7-mono text-[10px]" style={{ color: s.active ? "var(--positive)" : "var(--text-3)" }}>{s.time}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center justify-between px-8 py-[22px] border-b" style={{ borderColor: "var(--border)" }}>
          <div className="flex flex-col gap-0.5">
            <span className="text-[14.5px] font-semibold">Man City vs Arsenal check</span>
            <span className="text-[11.5px]" style={{ color: "var(--text-3)" }}>Linked to Predict — Football</span>
          </div>
          <button className="flex items-center gap-2 rounded-[10px] border px-3.5 py-2 cursor-pointer" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--positive)" }} />
            <span className="text-[12.5px]">Auto · routes per task</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2" strokeLinecap="round">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
        </div>

        <div className="flex-1 px-8 py-7 flex flex-col gap-5 overflow-y-auto">
          {MESSAGES.map((m, i) =>
            m.role === "user" ? (
              <div key={i} className="flex justify-end">
                <div className="max-w-[480px] rounded-[14px] rounded-br-[2px] px-4 py-3 border" style={{ background: "#2B2013", borderColor: "#3C2C18" }}>
                  <span className="text-[13.5px] leading-relaxed" style={{ color: "var(--text)" }}>{m.text}</span>
                </div>
              </div>
            ) : (
              <div key={i} className="flex flex-col gap-1.5 max-w-[560px]">
                <div className="rounded-[14px] rounded-bl-[2px] px-4 py-3.5 tr7-card">
                  <span className="text-[13.5px] leading-relaxed" style={{ color: "var(--text)" }}>{m.text}</span>
                </div>
                <span className="tr7-mono text-[10.5px] pl-1" style={{ color: "var(--text-3)" }}>{m.model}</span>
              </div>
            )
          )}
        </div>

        <div className="px-8 pb-7 pt-5">
          <div className="flex items-center gap-2.5 rounded-[14px] border pl-4 pr-2.5 py-2" style={{ background: "var(--surface)", borderColor: "var(--border-2)" }}>
            <button aria-label="Attach file" className="bg-transparent border-none cursor-pointer flex">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--text-2)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.5l-8.5 8.5a5 5 0 01-7-7l9-9a3.5 3.5 0 015 5l-9 9a2 2 0 01-3-3l8-8" />
              </svg>
            </button>
            <button aria-label="Attach image" className="bg-transparent border-none cursor-pointer flex">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--text-2)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <circle cx="9" cy="10.5" r="1.4" />
                <path d="M21 16l-5.5-5.5-4 4L8 11l-5 5" />
              </svg>
            </button>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              type="text"
              placeholder="Ask anything, or paste a prediction to compare..."
              className="flex-1 bg-transparent outline-none text-[13.5px]"
              style={{ color: "var(--text)" }}
            />
            <span className="text-[11px] px-1" style={{ color: "var(--text-3)" }}>Auto</span>
            <button
              aria-label="Send message"
              disabled={!draft.trim()}
              className="w-[34px] h-[34px] rounded-[10px] flex items-center justify-center shrink-0 cursor-pointer disabled:opacity-40"
              style={{ background: "var(--accent)" }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--accent-contrast)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
