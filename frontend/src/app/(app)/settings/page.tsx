"use client";

import { useState } from "react";
import { ThemeSwatches } from "@/components/ThemeSwatches";

const PROVIDERS = [
  { id: "openai", letter: "O", name: "OpenAI", models: "GPT-5 · GPT-5 mini", connected: true },
  { id: "gemini", letter: "G", name: "Google Gemini", models: "Gemini · strong on vision/document parsing", connected: true },
  { id: "ollama", letter: "L", name: "Ollama (local)", models: "Runs on your machine · no key needed", connected: true },
  { id: "xai", letter: "X", name: "xAI Grok", models: "No API key added", connected: false },
  { id: "deepseek", letter: "D", name: "DeepSeek", models: "No API key added", connected: false },
];

const ROUTING = [
  { task: "Vision / document parsing", chain: ["Gemini", "GPT-5"] },
  { task: "Football reasoning", chain: ["Claude Opus 5", "GPT-5"] },
  { task: "Everyday chat", chain: ["Claude Haiku 4.5", "local"] },
];

const USAGE = [
  { name: "Anthropic", pct: 68, cost: "$8.40", color: "var(--accent)" },
  { name: "OpenAI", pct: 22, cost: "$2.70", color: "var(--pending)" },
  { name: "Gemini", pct: 10, cost: "$1.30", color: "var(--text-3)" },
];

export default function SettingsPage() {
  const [anthropicOpen, setAnthropicOpen] = useState(true);

  return (
    <div className="p-9 flex flex-col gap-[22px]">
      <div className="flex flex-col gap-1">
        <span className="text-[11px] tracking-wider uppercase" style={{ color: "var(--text-3)" }}>Settings</span>
        <h1 className="tr7-display text-[26px] font-bold m-0">LLM providers &amp; keys</h1>
      </div>

      <div className="flex gap-5 items-start">
        <div className="flex-1 flex flex-col gap-3">
          <div className="tr7-card p-5 flex flex-col gap-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-[9px] border flex items-center justify-center" style={{ background: "var(--surface-2)", borderColor: "var(--border-2)" }}>
                  <span className="tr7-mono text-[11px]" style={{ color: "var(--accent)" }}>A</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[13.5px] font-semibold">Anthropic</span>
                  <span className="text-[11.5px]" style={{ color: "var(--text-2)" }}>Claude Opus 5 · Sonnet 5 · Haiku 4.5</span>
                </div>
              </div>
              <div className="flex items-center gap-3.5">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--positive)" }} />
                  <span className="text-xs" style={{ color: "var(--text-2)" }}>Connected</span>
                </div>
                <button onClick={() => setAnthropicOpen((v) => !v)} className="tr7-btn-ghost cursor-pointer !py-1.5 !px-3.5 text-xs">
                  {anthropicOpen ? "Hide key" : "Manage"}
                </button>
              </div>
            </div>

            {anthropicOpen && (
              <div className="flex flex-col gap-2.5 pt-1.5 border-t" style={{ borderColor: "var(--surface-2)" }}>
                <div className="flex gap-2.5 items-center">
                  <div className="flex-1 rounded-[10px] border px-3.5 py-2.5" style={{ background: "var(--bg)", borderColor: "var(--border)" }}>
                    <span className="tr7-mono text-[12.5px]" style={{ color: "var(--text-2)" }}>sk-ant-••••••••••••4f2c</span>
                  </div>
                  <button className="tr7-btn-ghost cursor-pointer !py-2.5" style={{ background: "var(--surface-2)" }}>Test</button>
                  <button className="tr7-btn-primary cursor-pointer">Save</button>
                </div>
                <div className="flex gap-1.5">
                  {["chat", "vision", "reasoning"].map((cap) => (
                    <span key={cap} className="text-[11px] rounded-full border px-2.5 py-1" style={{ color: "var(--text-2)", background: "var(--bg)", borderColor: "var(--border)" }}>{cap}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {PROVIDERS.map((p) => (
            <div key={p.id} className="tr7-card p-5 flex items-center justify-between" style={{ opacity: p.connected ? 1 : 0.75 }}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-[9px] border flex items-center justify-center" style={{ background: "var(--surface-2)", borderColor: "var(--border-2)" }}>
                  <span className="tr7-mono text-[11px]" style={{ color: p.connected ? "var(--text-2)" : "var(--text-3)" }}>{p.letter}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[13.5px] font-semibold" style={{ color: p.connected ? "var(--text)" : "var(--text-2)" }}>{p.name}</span>
                  <span className="text-[11.5px]" style={{ color: p.connected ? "var(--text-2)" : "var(--text-3)" }}>{p.models}</span>
                </div>
              </div>
              <div className="flex items-center gap-3.5">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: p.connected ? "var(--positive)" : "var(--border-2)" }} />
                  <span className="text-xs" style={{ color: "var(--text-3)" }}>{p.connected ? "Connected" : "Not connected"}</span>
                </div>
                <button className="tr7-btn-ghost cursor-pointer !py-1.5 !px-3.5 text-xs" style={{ background: p.connected ? "transparent" : "var(--surface-2)" }}>
                  {p.connected ? "Manage" : "Connect"}
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="w-[360px] shrink-0 flex flex-col gap-4">
          <div className="tr7-card p-5 flex flex-col gap-3.5">
            <span className="text-[13px] font-semibold">Appearance</span>
            <div className="flex flex-col gap-2">
              <span className="text-[11.5px]" style={{ color: "var(--text-3)" }}>Theme</span>
              <ThemeSwatches size="md" />
            </div>
            <span className="text-[10.5px] leading-relaxed" style={{ color: "var(--text-3)" }}>
              Applies everywhere — Chat, Predict, Bankroll. Custom accent colors coming later.
            </span>
          </div>

          <div className="tr7-card p-5 flex flex-col gap-3.5">
            <span className="text-[13px] font-semibold">Model routing</span>
            {ROUTING.map((r) => (
              <div key={r.task} className="flex flex-col gap-1">
                <span className="text-[11.5px]" style={{ color: "var(--text-3)" }}>{r.task}</span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="tr7-mono text-[11.5px] rounded-full border px-2.5 py-1" style={{ background: "var(--bg)", borderColor: "var(--border)" }}>{r.chain[0]}</span>
                  <span className="text-[11px]" style={{ color: "var(--text-3)" }}>then</span>
                  <span className="tr7-mono text-[11.5px] rounded-full border px-2.5 py-1" style={{ background: "var(--bg)", borderColor: "var(--border)", color: "var(--text-2)" }}>{r.chain[1]}</span>
                </div>
              </div>
            ))}
            <button className="self-start text-xs rounded-[9px] border border-dashed px-3.5 py-2 cursor-pointer" style={{ borderColor: "var(--border-2)", color: "var(--text-2)" }}>
              + Add task rule
            </button>
          </div>

          <div className="tr7-card p-5 flex flex-col gap-3">
            <span className="text-[13px] font-semibold">Usage this month</span>
            <span className="tr7-mono text-xl font-semibold">$12.40</span>
            <div className="flex flex-col gap-2">
              {USAGE.map((u) => (
                <div key={u.name} className="flex items-center gap-2.5">
                  <span className="w-[74px] text-[11.5px]" style={{ color: "var(--text-2)" }}>{u.name}</span>
                  <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--surface-2)" }}>
                    <div className="h-full" style={{ width: `${u.pct}%`, background: u.color }} />
                  </div>
                  <span className="tr7-mono text-[11px]" style={{ color: "var(--text-3)" }}>{u.cost}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
