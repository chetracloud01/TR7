"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { ThemeSwatches } from "@/components/ThemeSwatches";
import { ProviderCard, ProviderOut } from "@/components/ProviderCard";
import { PROVIDER_CATALOG, TOTAL_PROVIDER_COUNT } from "@/data/providers";

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
  const [providers, setProviders] = useState<ProviderOut[] | null>(null);

  const refresh = useCallback(() => {
    api.get<ProviderOut[]>("/providers").then(setProviders).catch(() => setProviders([]));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const connectedCount = (providers?.filter((p) => p.connected).length ?? 0) + 1; // +1 for keyless Ollama

  return (
    <div className="p-9 flex flex-col gap-[22px]">
      <div className="flex flex-col gap-1">
        <span className="text-[11px] tracking-wider uppercase" style={{ color: "var(--text-3)" }}>Settings</span>
        <h1 className="tr7-display text-[26px] font-bold m-0">LLM providers &amp; keys</h1>
        {providers && (
          <span className="text-xs" style={{ color: "var(--text-3)" }}>{connectedCount} of {TOTAL_PROVIDER_COUNT} providers connected</span>
        )}
      </div>

      <div className="flex gap-5 items-start">
        <div className="flex-1 flex flex-col gap-3">
          {providers === null ? (
            <span className="text-sm" style={{ color: "var(--text-3)" }}>Loading providers...</span>
          ) : (
            <>
              {PROVIDER_CATALOG.map((entry) => (
                <ProviderCard
                  key={entry.name}
                  entry={entry}
                  provider={providers.find((p) => p.name === entry.name)}
                  onChange={refresh}
                />
              ))}

              <div className="tr7-card p-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-[9px] border flex items-center justify-center" style={{ background: "var(--surface-2)", borderColor: "var(--border-2)" }}>
                    <span className="tr7-mono text-[11px]" style={{ color: "var(--text-2)" }}>L</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[13.5px] font-semibold">Ollama (local)</span>
                    <span className="text-[11.5px]" style={{ color: "var(--text-2)" }}>Runs on your machine · no key needed</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--positive)" }} />
                  <span className="text-xs" style={{ color: "var(--text-2)" }}>Connected</span>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="w-[360px] shrink-0 flex flex-col gap-4">
          <div className="tr7-card p-5 flex flex-col gap-3.5">
            <span className="text-[13px] font-semibold">Appearance</span>
            <div className="flex flex-col gap-2">
              <span className="text-[11.5px]" style={{ color: "var(--text-3)" }}>Theme</span>
              <ThemeSwatches size="md" />
            </div>
            <span className="text-[10.5px] leading-relaxed" style={{ color: "var(--text-3)" }}>
              Applies everywhere — Chat, Predict, Bankroll. Saved to your account, synced on every device.
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
            <span className="text-[10.5px]" style={{ color: "var(--text-3)" }}>Editable once the LLM Gateway lands (Phase 3).</span>
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
            <span className="text-[10.5px]" style={{ color: "var(--text-3)" }}>Logged for real once the gateway is calling providers (Phase 3).</span>
          </div>
        </div>
      </div>
    </div>
  );
}
