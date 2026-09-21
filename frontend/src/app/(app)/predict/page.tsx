"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { Pill, Stars, riskTone } from "@/components/ui";

interface BoardRow {
  id: number;
  kickoff_ict: string;
  home_team: string;
  home_team_country: string;
  away_team: string;
  away_team_country: string;
  competition_country: string;
  competition: string;
  odds_home: number;
  odds_draw: number;
  odds_away: number;
  app_predicted_score: string;
  researched: boolean;
  my_predicted_score: string | null;
  stars: number | null;
  risk_tier: "low" | "medium" | "high" | null;
  usage_flag: string | null;
  result_status: "pending" | "won" | "lost";
  result_score: string | null;
}

interface Batch {
  id: number;
  created_at: string;
  matches: BoardRow[];
  parse_warnings?: { raw_row: string; errors: string[] }[];
}

interface BatchSummary {
  id: number;
  created_at: string;
  match_count: number;
}

interface MatchDetail {
  id: number;
  my_predicted_score: string | null;
  confidence: { stars: number } | null;
  risk_tier: string | null;
  usage_flag: string | null;
  result: { status: "pending" | "won" | "lost"; score: string | null };
}

const FLAG_LABELS: Record<string, string> = {
  banker_only: "\u{1F512} BANKER ONLY",
  lottery_odd: "\u{1F3B2} LOTTERY ODD",
  friendly: "\u{1F3AD} FRIENDLY",
};

type Mode = "full" | "qualifying";

function mergeDetail(row: BoardRow, detail: MatchDetail): BoardRow {
  return {
    ...row,
    researched: true,
    my_predicted_score: detail.my_predicted_score,
    stars: detail.confidence?.stars ?? null,
    risk_tier: (detail.risk_tier as BoardRow["risk_tier"]) ?? null,
    usage_flag: detail.usage_flag,
    result_status: detail.result.status,
    result_score: detail.result.score,
  };
}

export default function PredictBoardPage() {
  const [batch, setBatch] = useState<Batch | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode>("full");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [draftText, setDraftText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [researchingIds, setResearchingIds] = useState<Set<number>>(new Set());
  const [rowErrors, setRowErrors] = useState<Record<number, string>>({});

  useEffect(() => {
    api.get<BatchSummary[]>("/football/batches").then(async (batches) => {
      if (batches.length > 0) {
        const full = await api.get<Batch>(`/football/batches/${batches[0].id}`);
        setBatch(full);
      } else {
        setUploadOpen(true);
      }
      setLoading(false);
    });
  }, []);

  async function parseBatch() {
    if (!draftText.trim() || parsing) return;
    setParsing(true);
    setParseError(null);
    try {
      const result = await api.post<Batch>("/football/batches", { text: draftText });
      setBatch(result);
      setDraftText("");
      setUploadOpen(false);
    } catch (err) {
      setParseError(err instanceof ApiError ? err.message : "Couldn't parse that batch.");
    } finally {
      setParsing(false);
    }
  }

  async function researchOne(matchId: number) {
    setResearchingIds((prev) => new Set(prev).add(matchId));
    setRowErrors((prev) => ({ ...prev, [matchId]: "" }));
    try {
      const detail = await api.post<MatchDetail>(`/football/matches/${matchId}/research`);
      setBatch((prev) => (prev ? { ...prev, matches: prev.matches.map((m) => (m.id === matchId ? mergeDetail(m, detail) : m)) } : prev));
    } catch (err) {
      setRowErrors((prev) => ({ ...prev, [matchId]: err instanceof ApiError ? err.message : "Research failed." }));
    } finally {
      setResearchingIds((prev) => {
        const next = new Set(prev);
        next.delete(matchId);
        return next;
      });
    }
  }

  async function researchAll() {
    const unresearched = batch?.matches.filter((m) => !m.researched) ?? [];
    for (const m of unresearched) {
      await researchOne(m.id);
    }
  }

  const rows = batch ? (mode === "full" ? batch.matches : batch.matches.filter((m) => !m.usage_flag)) : [];
  const settled = batch?.matches.filter((m) => m.result_status !== "pending") ?? [];
  const wins = settled.filter((m) => m.result_status === "won").length;
  const losses = settled.filter((m) => m.result_status === "lost").length;
  const unresearchedCount = batch?.matches.filter((m) => !m.researched).length ?? 0;

  return (
    <div className="p-9 flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <span className="text-[11px] tracking-wider uppercase" style={{ color: "var(--text-3)" }}>
            Predict — Football
          </span>
          <h1 className="tr7-display text-[26px] font-bold m-0">Full Match Board</h1>
          <span className="text-sm" style={{ color: "var(--text-2)" }}>
            {batch ? `${batch.matches.length} matches parsed · ranked by star rating` : loading ? "Loading..." : "No batch yet — add one below"}
          </span>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="flex gap-1 p-[3px] rounded-[10px] tr7-card">
            <button onClick={() => setMode("full")} className="px-3.5 py-2 rounded-lg text-[12.5px] font-medium cursor-pointer" style={{ background: mode === "full" ? "var(--surface-2)" : "transparent", color: mode === "full" ? "var(--text)" : "var(--text-2)" }}>
              Full Rating
            </button>
            <button onClick={() => setMode("qualifying")} className="px-3.5 py-2 rounded-lg text-[12.5px] font-medium cursor-pointer" style={{ background: mode === "qualifying" ? "var(--surface-2)" : "transparent", color: mode === "qualifying" ? "var(--text)" : "var(--text-2)" }}>
              Qualifying
            </button>
          </div>
          {batch && (
            <a href={`/api/football/batches/${batch.id}/export.xlsx`} className="tr7-btn-ghost">
              Export .xlsx
            </a>
          )}
          {unresearchedCount > 0 && (
            <button onClick={researchAll} className="tr7-btn-primary cursor-pointer">
              Research all ({unresearchedCount})
            </button>
          )}
        </div>
      </div>

      <span className="text-xs -mt-2" style={{ color: "var(--text-3)" }}>
        {mode === "full"
          ? "Every match is shown — banker, lottery-odd and friendly picks get a usage flag instead of being dropped."
          : "Showing only picks without a usage flag."}
      </span>

      <div className="tr7-card p-4 flex flex-col gap-3.5">
        <button onClick={() => setUploadOpen((v) => !v)} className="flex items-center justify-between bg-transparent border-none p-0 cursor-pointer" style={{ color: "var(--text)" }}>
          <div className="flex items-center gap-2.5">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" />
            </svg>
            <span className="text-[13px] font-semibold">Add batch — paste the sheet</span>
          </div>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: uploadOpen ? "rotate(180deg)" : "none" }}>
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>

        {uploadOpen && (
          <div className="flex flex-col gap-3 pt-0.5 border-t" style={{ borderColor: "var(--surface-2)" }}>
            <textarea
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
              placeholder={"Paste the markdown table — | Date & Kickoff (ICT) | Country | League / Competition | Match | Predicted Score | Market Odds (1X2) |"}
              className="w-full h-[120px] resize-none rounded-[10px] p-3 text-sm tr7-mono border border-dashed outline-none"
              style={{ background: "var(--bg)", borderColor: "var(--border-2)", color: "var(--text)" }}
            />
            <span className="text-[11px]" style={{ color: "var(--text-3)" }}>
              Screenshot and file upload need a vision-capable provider call this build doesn&apos;t make yet — paste as text for now.
            </span>
            {parseError && <span className="text-xs" style={{ color: "var(--danger)" }}>{parseError}</span>}
            <button onClick={parseBatch} disabled={!draftText.trim() || parsing} className="self-start tr7-btn-primary cursor-pointer disabled:opacity-50">
              {parsing ? "Parsing..." : "Parse batch"}
            </button>
          </div>
        )}
      </div>

      {batch && batch.parse_warnings && batch.parse_warnings.length > 0 && (
        <div className="tr7-card p-4 flex flex-col gap-1.5" style={{ borderColor: "var(--danger)" }}>
          <span className="text-xs font-semibold" style={{ color: "var(--danger)" }}>{batch.parse_warnings.length} row(s) skipped or incomplete</span>
          {batch.parse_warnings.map((w, i) => (
            <span key={i} className="text-[11.5px]" style={{ color: "var(--text-2)" }}>{w.raw_row}: {w.errors.join("; ")}</span>
          ))}
        </div>
      )}

      {batch && (
        <div className="tr7-card overflow-hidden">
          <div className="grid gap-2 px-5 py-3 text-[10.5px] uppercase tracking-wider border-b" style={{ gridTemplateColumns: "0.4fr 1.1fr 1.9fr 1.4fr 0.7fr 0.7fr 0.7fr 0.9fr 0.9fr 0.8fr 1.1fr", background: "var(--bg)", borderColor: "var(--border)", color: "var(--text-3)" }}>
            <span>#</span><span>Kickoff (ICT)</span><span>Match (team country)</span><span>Country / Comp</span><span>Odd</span><span>App CS</span><span>My CS</span><span>Result</span><span>Rate</span><span>Risk</span><span>Flag</span>
          </div>

          {rows.map((m, i) => {
            const researching = researchingIds.has(m.id);
            const rowError = rowErrors[m.id];
            return (
              <div key={m.id} className="grid gap-2 px-5 py-3.5 items-center border-b text-sm last:border-b-0" style={{ gridTemplateColumns: "0.4fr 1.1fr 1.9fr 1.4fr 0.7fr 0.7fr 0.7fr 0.9fr 0.9fr 0.8fr 1.1fr", borderColor: "var(--surface-2)", color: "var(--text)" }}>
                <span className="tr7-mono text-[12.5px]" style={{ color: "var(--text-3)" }}>{i + 1}</span>
                <span className="tr7-mono text-[11.5px]" style={{ color: "var(--text-2)" }}>{new Date(m.kickoff_ict).toLocaleString(undefined, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                <Link href={`/predict/${m.id}`} className="text-[13px] font-medium hover:underline">
                  {m.home_team} {m.home_team_country && <span style={{ color: "var(--text-3)", fontWeight: 400 }}>({m.home_team_country})</span>} vs {m.away_team}{" "}
                  {m.away_team_country && <span style={{ color: "var(--text-3)", fontWeight: 400 }}>({m.away_team_country})</span>}
                </Link>
                <span className="text-[11.5px]" style={{ color: "var(--text-2)" }}>{m.competition_country} · {m.competition}</span>
                <span className="tr7-mono text-[12.5px]">{m.odds_home.toFixed(2)}</span>
                <span className="tr7-mono text-[12.5px]" style={{ color: "var(--text-2)" }}>{m.app_predicted_score}</span>
                <span className="tr7-mono text-[12.5px]">{m.my_predicted_score ?? "—"}</span>
                <div className="flex flex-col gap-0.5">
                  <span className="tr7-mono text-[12.5px]" style={{ color: m.result_score ? "var(--text)" : "var(--text-3)" }}>{m.result_score ?? "—"}</span>
                  <span className="text-[10px]" style={{ color: m.result_status === "won" ? "var(--positive)" : m.result_status === "lost" ? "var(--danger)" : "var(--pending)" }}>
                    {m.result_status === "won" ? "Won" : m.result_status === "lost" ? "Lost" : "Pending"}
                  </span>
                </div>
                {m.researched ? <Stars count={m.stars ?? 0} /> : (
                  <button onClick={() => researchOne(m.id)} disabled={researching} className="text-[11.5px] rounded-lg border px-2.5 py-1.5 cursor-pointer disabled:opacity-50 w-fit" style={{ borderColor: "var(--border-2)", color: "var(--text-2)" }}>
                    {researching ? "Researching..." : "Research"}
                  </button>
                )}
                {m.risk_tier ? <Pill tone={riskTone(m.risk_tier)}>{m.risk_tier.toUpperCase()}</Pill> : <span className="text-[10.5px]" style={{ color: "var(--text-3)" }}>—</span>}
                {rowError ? (
                  <span className="text-[10.5px]" style={{ color: "var(--danger)" }}>{rowError}</span>
                ) : m.usage_flag ? (
                  <Pill tone="neutral">{FLAG_LABELS[m.usage_flag] ?? m.usage_flag}</Pill>
                ) : (
                  <span className="text-[10.5px]" style={{ color: "var(--text-3)" }}>—</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {batch && (
        <div className="flex items-center gap-6 px-1">
          <span className="text-xs" style={{ color: "var(--text-2)" }}>{batch.matches.length - unresearchedCount} of {batch.matches.length} matches researched</span>
          <span className="text-xs" style={{ color: "var(--text-2)" }}>{settled.length} of {batch.matches.length} settled — <span style={{ color: "var(--positive)" }}>{wins}W</span>–<span style={{ color: "var(--danger)" }}>{losses}L</span></span>
        </div>
      )}
    </div>
  );
}
