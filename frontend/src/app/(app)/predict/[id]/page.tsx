"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { Pill, Stars, riskTone } from "@/components/ui";

interface RuleOut { code: string; label: string; fired: boolean; note: string }
interface ConfidenceOut { factors: { label: string; points: number }[]; total: number; stars: number }
interface CascadeOut { margin: number; btts: boolean; over_under: string; handicap_note: string }
interface StakeOut { pct: number; amount: number }
interface ResultOut { status: "pending" | "won" | "lost"; score: string | null; settled_at: string | null }

interface MatchDetail {
  id: number;
  home_team: string;
  home_team_country: string;
  away_team: string;
  away_team_country: string;
  competition: string;
  competition_country: string;
  kickoff_ict: string;
  odds_home: number;
  odds_draw: number;
  odds_away: number;
  app_predicted_score: string;
  app_implied_prob_pct: number;
  app_ev: number;
  researched: boolean;
  my_predicted_score: string | null;
  my_raw_prob_pct: number | null;
  my_disc_prob_pct: number | null;
  my_ev: number | null;
  rationale: string | null;
  model_used: string | null;
  agreement: string | null;
  final_tip: string | null;
  final_odd: number | null;
  final_prob: number | null;
  cascade: CascadeOut | null;
  rules: RuleOut[];
  confidence: ConfidenceOut | null;
  risk_tier: string | null;
  usage_flag: string | null;
  stake: StakeOut | null;
  result: ResultOut;
}

function pct(x: number) {
  return `${x >= 0 ? "+" : ""}${(x * 100).toFixed(1)}%`;
}

export default function MatchDetailPage() {
  const params = useParams<{ id: string }>();
  const [match, setMatch] = useState<MatchDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [researching, setResearching] = useState(false);
  const [researchError, setResearchError] = useState<string | null>(null);
  const [resultInput, setResultInput] = useState("");
  const [recording, setRecording] = useState(false);

  useEffect(() => {
    api.get<MatchDetail>(`/football/matches/${params.id}`).then((m) => {
      setMatch(m);
      setLoading(false);
    });
  }, [params.id]);

  async function research() {
    setResearching(true);
    setResearchError(null);
    try {
      const m = await api.post<MatchDetail>(`/football/matches/${params.id}/research`);
      setMatch(m);
    } catch (err) {
      setResearchError(err instanceof ApiError ? err.message : "Research failed.");
    } finally {
      setResearching(false);
    }
  }

  async function recordResult() {
    if (!resultInput.trim() || recording) return;
    setRecording(true);
    try {
      const m = await api.post<MatchDetail>(`/football/matches/${params.id}/result`, { actual_score: resultInput.trim() });
      setMatch(m);
      setResultInput("");
    } catch (err) {
      setResearchError(err instanceof ApiError ? err.message : "Couldn't save the result.");
    } finally {
      setRecording(false);
    }
  }

  if (loading || !match) {
    return <div className="p-8"><span className="text-sm" style={{ color: "var(--text-3)" }}>Loading...</span></div>;
  }

  return (
    <div className="p-8 flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Link href="/predict" className="flex items-center gap-1.5 text-[12.5px] w-fit" style={{ color: "var(--text-2)" }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Full Match Board
        </Link>
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <h1 className="tr7-display text-[25px] font-bold m-0">
              {match.home_team} {match.home_team_country && <span style={{ color: "var(--text-3)", fontWeight: 400, fontSize: 15 }}>({match.home_team_country})</span>}{" "}
              <span style={{ color: "var(--text-3)", fontWeight: 500 }}>vs</span> {match.away_team}{" "}
              {match.away_team_country && <span style={{ color: "var(--text-3)", fontWeight: 400, fontSize: 15 }}>({match.away_team_country})</span>}
            </h1>
            <span className="text-[12.5px]" style={{ color: "var(--text-2)" }}>
              {match.competition_country} · {match.competition} · {new Date(match.kickoff_ict).toLocaleString(undefined, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })} ICT · Odd {match.odds_home.toFixed(2)}
            </span>
          </div>
          {match.researched && match.agreement && (
            <Pill tone={match.agreement === "agree" ? "positive" : match.agreement === "disagree" ? "danger" : "pending"}>
              {match.agreement === "agree" ? `✓ AGREE — both back ${match.home_team}` : match.agreement === "disagree" ? "✗ DISAGREE" : "⚠ PARTIAL"}
            </Pill>
          )}
        </div>
      </div>

      {!match.researched ? (
        <div className="tr7-card p-6 flex flex-col gap-3 items-start">
          <span className="text-sm" style={{ color: "var(--text-2)" }}>
            Market implies {match.app_implied_prob_pct}% for the app&apos;s predicted side ({match.app_predicted_score}), EV {pct(match.app_ev)}. Run research for an independent read.
          </span>
          {researchError && <span className="text-xs" style={{ color: "var(--danger)" }}>{researchError}</span>}
          <button onClick={research} disabled={researching} className="tr7-btn-primary cursor-pointer disabled:opacity-50">
            {researching ? "Researching..." : "Run research"}
          </button>
        </div>
      ) : (
        <>
          <div className="tr7-card overflow-hidden">
            <div className="grid gap-2 px-5 py-3 text-[10.5px] uppercase tracking-wider border-b" style={{ gridTemplateColumns: "1.4fr 1fr 1fr", background: "var(--bg)", borderColor: "var(--border)", color: "var(--text-3)" }}>
              <span>Field</span><span>App (source 1)</span><span>My research</span>
            </div>
            <Row label="Win probability" a={`${match.app_implied_prob_pct}% implied`} b={<span className="tr7-mono">{match.my_raw_prob_pct}% raw &rarr; <span style={{ color: "var(--positive)" }}>{match.my_disc_prob_pct}% disc.</span></span>} />
            <Row label="Market odd" a={match.odds_home.toFixed(2)} b={`${match.final_odd?.toFixed(2)}`} />
            <Row label="Predicted score" a={match.app_predicted_score} b={match.my_predicted_score ?? "—"} />
            <Row label="EV = (prob × odd) − 1" a={<span style={{ color: "var(--pending)" }}>{pct(match.app_ev)}</span>} b={<span style={{ color: "var(--positive)" }}>{match.my_ev != null ? pct(match.my_ev) : "—"}</span>} last />
            <div className="flex items-center gap-5 px-5 py-3.5 border-t" style={{ background: "var(--bg)", borderColor: "var(--border)" }}>
              <span className="text-xs" style={{ color: "var(--text-3)" }}>Combined verdict</span>
              <span className="text-[12.5px] font-semibold" style={{ color: match.agreement === "agree" ? "var(--positive)" : "var(--pending)" }}>{match.agreement?.toUpperCase()}</span>
              <Divider />
              <span className="text-xs" style={{ color: "var(--text-3)" }}>Final tip</span>
              <span className="tr7-mono text-[12.5px]">{match.final_tip} @ {match.final_odd?.toFixed(2)}</span>
              <Divider />
              <span className="text-xs" style={{ color: "var(--text-3)" }}>Final prob (higher of the two)</span>
              <span className="tr7-mono text-[12.5px]" style={{ color: "var(--positive)" }}>{match.final_prob}%</span>
            </div>
          </div>

          <div className="flex gap-4 items-stretch">
            {match.cascade && (
              <div className="flex-1 tr7-card p-5 flex flex-col gap-3">
                <span className="text-[12.5px] font-semibold">Correct-score cascade</span>
                <div className="flex items-center gap-2">
                  <span className="tr7-mono text-xl font-semibold">{match.my_predicted_score}</span>
                  <span className="text-[11px]" style={{ color: "var(--text-3)" }}>margin {match.cascade.margin}</span>
                </div>
                <div className="flex flex-col gap-2 pt-1 border-t" style={{ borderColor: "var(--surface-2)" }}>
                  <KV k="BTTS (both > 0)" v={match.cascade.btts ? "YES" : "NO"} tone="positive" />
                  <KV k="Total goals &rarr; O/U 2.5" v={match.cascade.over_under} tone="positive" />
                  <KV k="Handicap support" v={match.cascade.margin === 0 ? "None" : `${match.home_team}, margin ${match.cascade.margin}`} />
                </div>
                <span className="text-[11px] leading-relaxed" style={{ color: "var(--text-3)" }}>{match.cascade.handicap_note}</span>
              </div>
            )}

            <div className="flex-1 tr7-card p-5 flex flex-col gap-2.5">
              <span className="text-[12.5px] font-semibold">Context rules (R1–R6)</span>
              {match.rules.map((r) => (
                <RuleLine key={r.code} code={r.code} text={`${r.label} — ${r.note}`} tone={!r.fired ? "positive" : "muted"} />
              ))}
            </div>

            {match.confidence && (
              <div className="flex-1 tr7-card p-5 flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[12.5px] font-semibold">Confidence score</span>
                  <Stars count={match.confidence.stars} />
                </div>
                <div className="flex flex-col gap-1">
                  {match.confidence.factors.map((f) => (
                    <div key={f.label} className="flex items-center justify-between">
                      <span className="text-[11.5px]" style={{ color: "var(--text-2)" }}>{f.label}</span>
                      <span className="tr7-mono text-[11.5px]">{f.points}/2</span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: "var(--surface-2)" }}>
                  <span className="text-[11.5px]" style={{ color: "var(--text-3)" }}>Total {match.confidence.total}/16 · Risk tier</span>
                  {match.risk_tier && <Pill tone={riskTone(match.risk_tier as "low" | "medium" | "high")}>{match.risk_tier.toUpperCase()}</Pill>}
                </div>
              </div>
            )}
          </div>

          {match.rationale && <p className="text-[13px] leading-relaxed m-0" style={{ color: "var(--text-2)" }}>{match.rationale}</p>}
          {match.model_used && <span className="tr7-mono text-[10.5px]" style={{ color: "var(--text-3)" }}>{match.model_used.replace(":", " · ")}</span>}

          {match.stake && match.risk_tier && (
            <div className="tr7-card p-5 flex items-center gap-6">
              <div className="flex flex-col gap-1 shrink-0">
                <span className="text-[11px]" style={{ color: "var(--text-3)" }}>Suggested stake · Kelly, {match.risk_tier} risk{match.risk_tier === "high" ? " — halved" : ""}</span>
                <span className="tr7-mono text-[22px] font-semibold" style={{ color: "var(--accent)" }}>
                  ${match.stake.amount.toFixed(2)} <span className="text-[13px] font-normal" style={{ color: "var(--text-3)" }}>· {match.stake.pct.toFixed(1)}% bankroll</span>
                </span>
              </div>
              <Divider tall />
              <p className="text-[12.5px] leading-relaxed m-0 flex-1" style={{ color: "var(--text-2)" }}>
                Bankroll figure is a placeholder until the Bankroll module (docs/MASTER_PLAN.md §6) is wired to real data.
              </p>
              <Link href="/chat" className="tr7-btn-ghost shrink-0">Discuss in chat</Link>
              <button className="tr7-btn-ghost shrink-0 cursor-pointer" disabled title="Bankroll module isn't wired yet">Add to bet slip</button>
            </div>
          )}
        </>
      )}

      <div className="tr7-card p-5 flex flex-col gap-3 w-[420px]">
        <div className="flex items-center justify-between">
          <span className="text-[12.5px] font-semibold">Result &amp; feedback</span>
          <Pill tone={match.result.status === "won" ? "positive" : match.result.status === "lost" ? "danger" : "pending"}>
            {match.result.status === "pending" ? "Pending" : match.result.status === "won" ? "Won" : "Lost"}
          </Pill>
        </div>
        {match.result.status === "pending" ? (
          <div className="flex flex-col gap-2">
            <span className="text-[11.5px] leading-relaxed" style={{ color: "var(--text-2)" }}>
              {match.result.score
                ? `Result recorded (${match.result.score}) — nothing to grade it against until research finishes.`
                : "No live results feed yet — enter the final score once it's played."}
            </span>
            <div className="flex gap-2">
              <input value={resultInput} onChange={(e) => setResultInput(e.target.value)} placeholder="e.g. 2-1" className="flex-1 rounded-lg border px-2.5 py-1.5 text-xs tr7-mono outline-none" style={{ background: "var(--bg)", borderColor: "var(--border)", color: "var(--text)" }} />
              <button onClick={recordResult} disabled={!resultInput.trim() || recording} className="tr7-btn-ghost cursor-pointer text-xs !py-1.5 disabled:opacity-50">{match.result.score ? "Update" : "Save"}</button>
            </div>
          </div>
        ) : (
          <p className="text-[11.5px] leading-relaxed m-0" style={{ color: "var(--text-2)" }}>Settled {match.result.score} — fed into this board.</p>
        )}
      </div>
    </div>
  );
}

function Row({ label, a, b, last }: { label: string; a: React.ReactNode; b: React.ReactNode; last?: boolean }) {
  return (
    <div className={`grid gap-2 px-5 py-3 items-center ${last ? "" : "border-b"}`} style={{ gridTemplateColumns: "1.4fr 1fr 1fr", borderColor: "var(--surface-2)" }}>
      <span className="text-[12.5px]" style={{ color: "var(--text-2)" }}>{label}</span>
      <span className="tr7-mono text-[13px]">{a}</span>
      <span className="tr7-mono text-[13px]">{b}</span>
    </div>
  );
}

function Divider({ tall }: { tall?: boolean }) {
  return <div className="w-px shrink-0" style={{ height: tall ? 36 : 16, background: "var(--border)" }} />;
}

function KV({ k, v, tone }: { k: string; v: string; tone?: "positive" }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs" style={{ color: "var(--text-2)" }}>{k}</span>
      <span className="text-xs font-semibold" style={{ color: tone === "positive" ? "var(--positive)" : "var(--text)" }}>{v}</span>
    </div>
  );
}

function RuleLine({ code, text, tone }: { code: string; text: string; tone: "positive" | "muted" }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-[11.5px] w-5" style={{ color: tone === "positive" ? "var(--positive)" : "var(--text-3)" }}>{code}</span>
      <span className="text-xs" style={{ color: "var(--text-2)" }}>{text}</span>
    </div>
  );
}
