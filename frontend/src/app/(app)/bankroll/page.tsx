"use client";

import { useState } from "react";
import { Pill } from "@/components/ui";

const HISTORY = [
  { match: "Man City vs Arsenal", market: "1X2", stake: 42, odds: 1.85, status: "pending" as const, pl: null },
  { match: "Newcastle vs Brighton", market: "Over 2.5", stake: 30, odds: 1.95, status: "won" as const, pl: 28.5 },
  { match: "Villa vs Fulham", market: "Away win", stake: 25, odds: 3.4, status: "lost" as const, pl: -25 },
  { match: "Real Madrid vs Sevilla", market: "1X2", stake: 50, odds: 1.4, status: "won" as const, pl: 20 },
];

const CHART_POINTS = "0,150 145,140 290,155 435,120 580,130 725,95 870,105 1015,70 1160,55";
const MONTHS = ["Apr", "May", "Jun", "Jul", "Aug", "Sep"];
const RANGES = ["30D", "90D", "All"] as const;

export default function BankrollPage() {
  const [range, setRange] = useState<(typeof RANGES)[number]>("30D");

  return (
    <div className="p-9 flex flex-col gap-[22px]">
      <div className="flex flex-col gap-1">
        <span className="text-[11px] tracking-wider uppercase" style={{ color: "var(--text-3)" }}>Bankroll</span>
        <h1 className="tr7-display text-[26px] font-bold m-0">Control</h1>
      </div>

      <div className="flex gap-4">
        <StatTile label="Bankroll balance" value="$2,480.50" sub="+4.2% this month" subTone="positive" />
        <StatTile label="ROI" value="18.6%" sub="Since Jan 1" />
        <StatTile label="Win rate" value="57%" sub="32W – 24L" />
        <StatTile label="Open bets" value="3" valueTone="accent" sub="$186.00 at risk" />
      </div>

      <div className="tr7-card p-6 flex flex-col gap-3.5">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-semibold">Bankroll over time</span>
          <div className="flex gap-1 p-[3px] rounded-lg border" style={{ background: "var(--bg)", borderColor: "var(--border)" }}>
            {RANGES.map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className="px-3 py-1.5 rounded-md text-[11.5px] font-medium cursor-pointer"
                style={{ background: range === r ? "var(--surface-2)" : "transparent", color: range === r ? "var(--text)" : "var(--text-3)" }}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
        <svg viewBox="0 0 1160 200" className="w-full h-[180px]" preserveAspectRatio="none">
          <line x1="0" y1="40" x2="1160" y2="40" stroke="var(--surface-2)" />
          <line x1="0" y1="100" x2="1160" y2="100" stroke="var(--surface-2)" />
          <line x1="0" y1="160" x2="1160" y2="160" stroke="var(--surface-2)" />
          <path d={`M${CHART_POINTS.split(" ").join(" L")} L1160,200 L0,200 Z`} fill="var(--positive)" fillOpacity={0.12} stroke="none" />
          <polyline points={CHART_POINTS} fill="none" stroke="var(--positive)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div className="flex justify-between px-0.5">
          {MONTHS.map((m) => (
            <span key={m} className="tr7-mono text-[10.5px]" style={{ color: "var(--text-3)" }}>{m}</span>
          ))}
        </div>
      </div>

      <div className="flex gap-5 items-start">
        <div className="flex-1 tr7-card pt-5 pb-1.5 flex flex-col">
          <span className="text-[13px] font-semibold px-[22px] pb-3.5">Bet history</span>
          <div className="grid gap-2 px-[22px] py-2 text-[10.5px] uppercase tracking-wider border-y" style={{ gridTemplateColumns: "2.4fr 1.2fr 0.9fr 0.9fr 1fr 0.9fr", borderColor: "var(--surface-2)", color: "var(--text-3)" }}>
            <span>Match</span>
            <span>Market</span>
            <span>Stake</span>
            <span>Odds</span>
            <span>Result</span>
            <span className="text-right">P&amp;L</span>
          </div>
          {HISTORY.map((h, i) => (
            <div
              key={h.match}
              className={`grid gap-2 px-[22px] py-3 items-center text-[12.5px] ${i < HISTORY.length - 1 ? "border-b" : ""}`}
              style={{ gridTemplateColumns: "2.4fr 1.2fr 0.9fr 0.9fr 1fr 0.9fr", borderColor: "#201911" }}
            >
              <span>{h.match}</span>
              <span style={{ color: "var(--text-2)" }}>{h.market}</span>
              <span className="tr7-mono">${h.stake.toFixed(2)}</span>
              <span className="tr7-mono">{h.odds.toFixed(2)}</span>
              <Pill tone={h.status === "won" ? "positive" : h.status === "lost" ? "danger" : "pending"}>
                {h.status === "won" ? "Won" : h.status === "lost" ? "Lost" : "Pending"}
              </Pill>
              <span className="tr7-mono text-right" style={{ color: h.pl == null ? "var(--text-3)" : h.pl > 0 ? "var(--positive)" : "var(--danger)" }}>
                {h.pl == null ? "—" : `${h.pl > 0 ? "+" : ""}$${h.pl.toFixed(2)}`}
              </span>
            </div>
          ))}
        </div>

        <div className="w-[340px] shrink-0 tr7-card p-5 flex flex-col gap-4">
          <span className="text-[13px] font-semibold">Staking rules</span>

          <div className="flex gap-1 p-[3px] rounded-[10px] border" style={{ background: "var(--bg)", borderColor: "var(--border)" }}>
            <span className="flex-1 text-center py-1.5 rounded-lg text-xs" style={{ color: "var(--text-3)" }}>Flat</span>
            <span className="flex-1 text-center py-1.5 rounded-lg text-xs" style={{ color: "var(--text-3)" }}>% bankroll</span>
            <span className="flex-1 text-center py-1.5 rounded-lg text-xs font-semibold" style={{ background: "var(--surface-2)", color: "var(--text)" }}>Kelly</span>
          </div>

          <Field label="Max stake per bet" value="5.0% of bankroll" />
          <Field label="Daily loss stop" value="$150.00" />

          <div className="flex items-center justify-between pt-1.5 border-t" style={{ borderColor: "var(--surface-2)" }}>
            <span className="text-xs" style={{ color: "var(--text)" }}>Auto-suggest stake from confidence</span>
            <div className="w-[34px] h-5 rounded-full flex justify-end p-0.5 box-border" style={{ background: "var(--positive)" }}>
              <div className="w-4 h-4 rounded-full" style={{ background: "var(--bg)" }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatTile({ label, value, sub, subTone, valueTone }: { label: string; value: string; sub: string; subTone?: "positive"; valueTone?: "accent" }) {
  return (
    <div className="flex-1 tr7-card p-[18px] flex flex-col gap-2">
      <span className="text-[11.5px]" style={{ color: "var(--text-3)" }}>{label}</span>
      <span className="tr7-mono text-2xl font-semibold" style={{ color: valueTone === "accent" ? "var(--accent)" : "var(--text)" }}>{value}</span>
      <span className="text-xs" style={{ color: subTone === "positive" ? "var(--positive)" : "var(--text-2)" }}>{sub}</span>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11.5px]" style={{ color: "var(--text-2)" }}>{label}</span>
      <div className="rounded-[10px] border px-3 py-2.5" style={{ background: "var(--bg)", borderColor: "var(--border)" }}>
        <span className="tr7-mono text-[13px]">{value}</span>
      </div>
    </div>
  );
}
