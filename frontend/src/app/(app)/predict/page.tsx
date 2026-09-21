"use client";

import Link from "next/link";
import { useState } from "react";
import { MATCHES } from "@/data/matches";
import { Pill, Stars, riskTone } from "@/components/ui";

type Mode = "full" | "qualifying";
type UploadTab = "text" | "image" | "file";

export default function PredictBoardPage() {
  const [mode, setMode] = useState<Mode>("full");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [tab, setTab] = useState<UploadTab>("image");

  const rows = mode === "full" ? MATCHES : MATCHES.filter((m) => !m.flag);
  const settled = MATCHES.filter((m) => m.result.status !== "pending");
  const wins = settled.filter((m) => m.result.status === "won").length;
  const losses = settled.filter((m) => m.result.status === "lost").length;

  return (
    <div className="p-9 flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <span className="text-[11px] tracking-wider uppercase" style={{ color: "var(--text-3)" }}>
            Predict — Football
          </span>
          <h1 className="tr7-display text-[26px] font-bold m-0">Full Match Board</h1>
          <span className="text-sm" style={{ color: "var(--text-2)" }}>
            {MATCHES.length} matches parsed · ranked by star rating · Sat 17 Sep batch
          </span>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="flex gap-1 p-[3px] rounded-[10px] tr7-card">
            <button
              onClick={() => setMode("full")}
              className="px-3.5 py-2 rounded-lg text-[12.5px] font-medium cursor-pointer"
              style={{ background: mode === "full" ? "var(--surface-2)" : "transparent", color: mode === "full" ? "var(--text)" : "var(--text-2)" }}
            >
              Full Rating
            </button>
            <button
              onClick={() => setMode("qualifying")}
              className="px-3.5 py-2 rounded-lg text-[12.5px] font-medium cursor-pointer"
              style={{ background: mode === "qualifying" ? "var(--surface-2)" : "transparent", color: mode === "qualifying" ? "var(--text)" : "var(--text-2)" }}
            >
              Qualifying
            </button>
          </div>
          <button className="tr7-btn-primary cursor-pointer">Export .xlsx</button>
        </div>
      </div>

      <span className="text-xs -mt-2" style={{ color: "var(--text-3)" }}>
        {mode === "full"
          ? "Every match is shown — banker, lottery-odd and friendly picks get a usage flag instead of being dropped."
          : "Showing only picks that clear every gate: odd ≥ 1.60, prob > 50%, EV > 0%, rules clear."}
      </span>

      <div className="tr7-card p-4 flex flex-col gap-3.5">
        <button
          onClick={() => setUploadOpen((v) => !v)}
          className="flex items-center justify-between bg-transparent border-none p-0 cursor-pointer"
          style={{ color: "var(--text)" }}
        >
          <div className="flex items-center gap-2.5">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" />
            </svg>
            <span className="text-[13px] font-semibold">Add batch — paste, screenshot, or file</span>
          </div>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: uploadOpen ? "rotate(180deg)" : "none" }}>
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>

        {uploadOpen && (
          <div className="flex flex-col gap-3 pt-0.5 border-t" style={{ borderColor: "var(--surface-2)" }}>
            <div className="flex gap-1 p-[3px] rounded-[10px] tr7-card w-[360px]">
              {(["text", "image", "file"] as UploadTab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className="flex-1 py-2 rounded-lg text-[12.5px] font-medium cursor-pointer"
                  style={{ background: tab === t ? "var(--surface-2)" : "transparent", color: tab === t ? "var(--text)" : "var(--text-2)" }}
                >
                  {t === "text" ? "Paste text" : t === "image" ? "Screenshot" : "PDF / file"}
                </button>
              ))}
            </div>

            {tab === "text" && (
              <textarea
                placeholder="Paste the sheet — Date & Kickoff, Country, League, Match, Predicted Score, Market Odds (1X2)..."
                className="w-full h-[84px] resize-none rounded-[10px] p-3 text-sm border border-dashed outline-none"
                style={{ background: "var(--bg)", borderColor: "var(--border-2)", color: "var(--text)" }}
              />
            )}
            {tab !== "text" && (
              <div className="flex items-center justify-center gap-2 h-[84px] rounded-[10px] border border-dashed" style={{ borderColor: "var(--border-2)", background: "var(--bg)" }}>
                <span className="text-[12.5px]" style={{ color: "var(--text-2)" }}>
                  {tab === "image" ? "Drop the app's screenshot or portfolio image" : "PDF portfolio, CSV or TXT — up to 10MB"}
                </span>
              </div>
            )}

            <button className="self-start tr7-btn-ghost cursor-pointer" style={{ background: "var(--surface-2)" }}>
              Parse batch
            </button>
          </div>
        )}
      </div>

      <div className="tr7-card overflow-hidden">
        <div
          className="grid gap-2 px-5 py-3 text-[10.5px] uppercase tracking-wider border-b"
          style={{ gridTemplateColumns: "0.4fr 1.1fr 1.9fr 1.4fr 0.7fr 0.7fr 0.7fr 0.9fr 0.9fr 0.8fr 1.1fr", background: "var(--bg)", borderColor: "var(--border)", color: "var(--text-3)" }}
        >
          <span>#</span>
          <span>Kickoff (ICT)</span>
          <span>Match (team country)</span>
          <span>Country / Comp</span>
          <span>Odd</span>
          <span>App CS</span>
          <span>My CS</span>
          <span>Result</span>
          <span>Rate</span>
          <span>Risk</span>
          <span>Flag</span>
        </div>

        {rows.map((m, i) => (
          <Link
            key={m.id}
            href={`/predict/${m.id}`}
            className="grid gap-2 px-5 py-3.5 items-center border-b text-sm last:border-b-0"
            style={{ gridTemplateColumns: "0.4fr 1.1fr 1.9fr 1.4fr 0.7fr 0.7fr 0.7fr 0.9fr 0.9fr 0.8fr 1.1fr", borderColor: "var(--surface-2)", color: "var(--text)" }}
          >
            <span className="tr7-mono text-[12.5px]" style={{ color: "var(--text-3)" }}>{i + 1}</span>
            <span className="tr7-mono text-[11.5px]" style={{ color: "var(--text-2)" }}>{m.kickoffIct}</span>
            <span className="text-[13px] font-medium">
              {m.home} <span style={{ color: "var(--text-3)", fontWeight: 400 }}>({m.homeCountry})</span> vs {m.away}{" "}
              <span style={{ color: "var(--text-3)", fontWeight: 400 }}>({m.awayCountry})</span>
            </span>
            <span className="text-[11.5px]" style={{ color: "var(--text-2)" }}>{m.competitionCountry} · {m.competition}</span>
            <span className="tr7-mono text-[12.5px]">{m.odd.toFixed(2)}</span>
            <span className="tr7-mono text-[12.5px]" style={{ color: "var(--text-2)" }}>{m.appCs}</span>
            <span className="tr7-mono text-[12.5px]">{m.myCs}</span>
            <div className="flex flex-col gap-0.5">
              <span className="tr7-mono text-[12.5px]" style={{ color: m.result.score ? "var(--text)" : "var(--text-3)" }}>
                {m.result.score ?? "—"}
              </span>
              <span
                className="text-[10px]"
                style={{ color: m.result.status === "won" ? "var(--positive)" : m.result.status === "lost" ? "var(--danger)" : "var(--pending)" }}
              >
                {m.result.status === "won" ? "Won" : m.result.status === "lost" ? "Lost" : "Pending"}
              </span>
            </div>
            <Stars count={m.stars} />
            <Pill tone={riskTone(m.risk)}>{m.risk}</Pill>
            {m.flag ? (
              <Pill tone="neutral">
                {m.flag === "BANKER ONLY" && "\u{1F512} "}
                {m.flag === "LOTTERY ODD" && "\u{1F3B2} "}
                {m.flag === "FRIENDLY LABEL" && "\u{1F3AD} "}
                {m.flag === "CS MISMATCH" && "⚠️ "}
                {m.flag}
              </Pill>
            ) : (
              <span className="text-[10.5px]" style={{ color: "var(--text-3)" }}>—</span>
            )}
          </Link>
        ))}
      </div>

      <div className="flex items-center gap-6 px-1">
        <span className="text-xs" style={{ color: "var(--text-2)" }}>{MATCHES.length} of {MATCHES.length} matches rated</span>
        <span className="text-xs" style={{ color: "var(--text-2)" }}>1 clears every qualifying gate</span>
        <span className="text-xs" style={{ color: "var(--text-2)" }}>
          {settled.length} of {MATCHES.length} settled — <span style={{ color: "var(--positive)" }}>{wins}W</span>–
          <span style={{ color: "var(--danger)" }}>{losses}L</span> — feeding the calibration log
        </span>
        <div className="flex-1" />
        <span className="text-xs" style={{ color: "var(--text-2)" }}>Daily exposure used</span>
        <div className="w-[140px] h-1.5 rounded-full overflow-hidden" style={{ background: "var(--surface-2)" }}>
          <div className="h-full" style={{ width: "42%", background: "var(--accent)" }} />
        </div>
        <span className="tr7-mono text-xs" style={{ color: "var(--accent)" }}>4.2% / 10%</span>
      </div>
    </div>
  );
}
