import Link from "next/link";
import { notFound } from "next/navigation";
import { getMatch, MATCHES } from "@/data/matches";
import { confidenceBreakdown, deriveCascade, ev, formatPct, suggestedStake } from "@/lib/predict";
import { Pill, Stars, riskTone } from "@/components/ui";

const BANKROLL_BALANCE = 2480.5;

export function generateStaticParams() {
  return MATCHES.map((m) => ({ id: m.id }));
}

export default async function MatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const match = getMatch(id);
  if (!match) notFound();

  const cascade = deriveCascade(match.myCs);
  const appEv = ev(match.appProbPct, match.odd);
  const myEv = ev(match.myDiscProbPct, match.odd);
  const finalProb = Math.max(match.appProbPct, match.myDiscProbPct);
  const { total, breakdown } = confidenceBreakdown(match.stars);
  const stake = suggestedStake(match.myDiscProbPct, match.odd, match.risk, BANKROLL_BALANCE);
  const agree = Math.abs(match.appProbPct - match.myDiscProbPct) < 30; // simple stand-in for the agreement scoring table

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
              {match.home} <span style={{ color: "var(--text-3)", fontWeight: 400, fontSize: 15 }}>({match.homeCountry})</span>{" "}
              <span style={{ color: "var(--text-3)", fontWeight: 500 }}>vs</span> {match.away}{" "}
              <span style={{ color: "var(--text-3)", fontWeight: 400, fontSize: 15 }}>({match.awayCountry})</span>
            </h1>
            <span className="text-[12.5px]" style={{ color: "var(--text-2)" }}>
              {match.competitionCountry} · {match.competition} · {match.kickoffIct} ICT · Odd {match.odd.toFixed(2)}{" "}
              <span style={{ color: "var(--positive)" }}>&#9679; live, synced 2m ago</span>
            </span>
          </div>
          <Pill tone={agree ? "positive" : "pending"}>
            {agree ? `✓ AGREE — both sources back ${match.home}` : "⚠ PARTIAL — sources diverge"}
          </Pill>
        </div>
      </div>

      <div className="tr7-card overflow-hidden">
        <div className="grid gap-2 px-5 py-3 text-[10.5px] uppercase tracking-wider border-b" style={{ gridTemplateColumns: "1.4fr 1fr 1fr", background: "var(--bg)", borderColor: "var(--border)", color: "var(--text-3)" }}>
          <span>Field</span>
          <span>App (source 1)</span>
          <span>My research</span>
        </div>
        <Row label="Win probability" a={`${match.appProbPct}%`} b={<span className="tr7-mono">{match.myRawProbPct}% raw &rarr; <span style={{ color: "var(--positive)" }}>{match.myDiscProbPct}% disc.</span></span>} />
        <Row label="1xBet odd" a={match.odd.toFixed(2)} b={`${match.odd.toFixed(2)} confirmed`} />
        <Row label="Predicted score" a={match.appCs} b={match.myCs} />
        <Row label="EV = (prob × odd) − 1" a={<span style={{ color: "var(--pending)" }}>{formatPct(appEv)}</span>} b={<span style={{ color: "var(--positive)" }}>{formatPct(myEv)}</span>} last />
        <div className="flex items-center gap-5 px-5 py-3.5 border-t" style={{ background: "var(--bg)", borderColor: "var(--border)" }}>
          <span className="text-xs" style={{ color: "var(--text-3)" }}>Combined verdict</span>
          <span className="text-[12.5px] font-semibold" style={{ color: agree ? "var(--positive)" : "var(--pending)" }}>{agree ? "AGREE" : "PARTIAL"}</span>
          <Divider />
          <span className="text-xs" style={{ color: "var(--text-3)" }}>Final tip</span>
          <span className="tr7-mono text-[12.5px]">{match.appCs === match.myCs ? "1" : "—"} @ {match.odd.toFixed(2)}</span>
          <Divider />
          <span className="text-xs" style={{ color: "var(--text-3)" }}>Final prob (higher of the two)</span>
          <span className="tr7-mono text-[12.5px]" style={{ color: "var(--positive)" }}>{finalProb}%</span>
        </div>
      </div>

      <div className="flex gap-4 items-stretch">
        <div className="flex-1 tr7-card p-5 flex flex-col gap-3">
          <span className="text-[12.5px] font-semibold">Correct-score cascade</span>
          <div className="flex items-center gap-2">
            <span className="tr7-mono text-xl font-semibold">{match.myCs}</span>
            <span className="text-[11px]" style={{ color: "var(--text-3)" }}>margin {cascade.margin}</span>
          </div>
          <div className="flex flex-col gap-2 pt-1 border-t" style={{ borderColor: "var(--surface-2)" }}>
            <KV k="BTTS (both > 0)" v={cascade.btts ? "YES" : "NO"} tone="positive" />
            <KV k="Total goals &rarr; O/U 2.5" v={cascade.overUnder} tone="positive" />
            <KV k="Handicap support" v={cascade.margin === 0 ? "None" : `${match.home}, margin ${cascade.margin}`} />
          </div>
          <span className="text-[11px] leading-relaxed" style={{ color: "var(--text-3)" }}>{cascade.handicapNote}</span>
        </div>

        <div className="flex-1 tr7-card p-5 flex flex-col gap-2.5">
          <span className="text-[12.5px] font-semibold">Context rules (R1–R6)</span>
          <RuleLine code="R1" text="Aggregate lead — n/a, not a two-leg tie" tone="muted" />
          <RuleLine code="R2" text="Dead rubber — n/a" tone="muted" />
          <RuleLine code="R3" text="Rotation — clear, no lineup news" tone="positive" />
          <RuleLine code="R4" text="Prob. discount — 0.87 applied" tone="positive" />
          <RuleLine code="R5" text="Level-tie home win — n/a" tone="muted" />
          <RuleLine code="R6" text={`Consensus — ${match.consensusNote}`} tone="positive" />
        </div>

        <div className="flex-1 tr7-card p-5 flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[12.5px] font-semibold">Confidence score</span>
            <Stars count={match.stars} />
          </div>
          <div className="flex flex-col gap-1">
            {breakdown.map((f) => (
              <div key={f.label} className="flex items-center justify-between">
                <span className="text-[11.5px]" style={{ color: "var(--text-2)" }}>{f.label}</span>
                <span className="tr7-mono text-[11.5px]">{f.points}/2</span>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: "var(--surface-2)" }}>
            <span className="text-[11.5px]" style={{ color: "var(--text-3)" }}>Total {total}/16 · Risk tier</span>
            <Pill tone={riskTone(match.risk)}>{match.risk}</Pill>
          </div>
        </div>

        <div className="flex-1 tr7-card p-5 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-[12.5px] font-semibold">Result &amp; feedback</span>
            <Pill tone={match.result.status === "won" ? "positive" : match.result.status === "lost" ? "danger" : "pending"}>
              {match.result.status === "pending" ? "Pending" : match.result.status === "won" ? "Won" : "Lost"}
            </Pill>
          </div>
          {match.result.status === "pending" ? (
            <p className="text-[11.5px] leading-relaxed m-0" style={{ color: "var(--text-2)" }}>
              Auto-settles from the live results feed ~90 min after kickoff — manual entry only if the fixture isn&apos;t covered.
            </p>
          ) : (
            <p className="text-[11.5px] leading-relaxed m-0" style={{ color: "var(--text-2)" }}>
              Settled {match.result.score} — fed into the bet slip, the calibration log, and this board.
            </p>
          )}
          <div className="flex flex-col gap-1.5 pt-1.5 border-t" style={{ borderColor: "var(--surface-2)" }}>
            <span className="text-[10.5px] uppercase tracking-wider" style={{ color: "var(--text-3)" }}>
              {match.result.status === "pending" ? "On settle, updates automatically" : "This settlement updated"}
            </span>
            <CheckLine text="Bet slip status → won / lost" />
            <CheckLine text="Calibration log — Brier score, CLV" />
            <CheckLine text="Full Match Board — predicted → actual score" />
          </div>
        </div>
      </div>

      <p className="text-[13px] leading-relaxed m-0" style={{ color: "var(--text-2)" }}>{match.rationale}</p>

      <div className="tr7-card p-5 flex items-center gap-6">
        <div className="flex flex-col gap-1 shrink-0">
          <span className="text-[11px]" style={{ color: "var(--text-3)" }}>Suggested stake · Kelly, {match.risk} risk{match.risk === "HIGH" ? " — halved" : " — no haircut"}</span>
          <span className="tr7-mono text-[22px] font-semibold" style={{ color: "var(--accent)" }}>
            ${stake.amount.toFixed(2)} <span className="text-[13px] font-normal" style={{ color: "var(--text-3)" }}>· {stake.pct.toFixed(1)}% bankroll</span>
          </span>
        </div>
        <Divider tall />
        <p className="text-[12.5px] leading-relaxed m-0 flex-1" style={{ color: "var(--text-2)" }}>
          {agree
            ? "Disagreement protocol not triggered — both sources land close together, so no override or star cap applies."
            : "Sources diverge enough to check the disagreement protocol before staking — see docs/MASTER_PLAN.md §5.1."}
        </p>
        <Link href="/chat" className="tr7-btn-ghost shrink-0">Discuss in chat</Link>
        <button className="tr7-btn-primary shrink-0 cursor-pointer">Add to bet slip</button>
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

function CheckLine({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--positive)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 6L9 17l-5-5" />
      </svg>
      <span className="text-[11.5px]" style={{ color: "var(--text-2)" }}>{text}</span>
    </div>
  );
}
