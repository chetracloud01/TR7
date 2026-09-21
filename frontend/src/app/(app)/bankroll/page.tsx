"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { Pill } from "@/components/ui";

interface LedgerEntry {
  id: number;
  transaction_type: string;
  amount: number;
  balance_after: number;
  related_bet_id: number | null;
  created_at: string;
}

interface Bet {
  id: number;
  match_id: number | null;
  match_label: string | null;
  prediction_id: number | null;
  market: string;
  stake: number;
  odds: number;
  potential_return: number;
  status: "pending" | "won" | "lost" | "void";
  pl: number | null;
  placed_at: string;
  settled_at: string | null;
}

interface Dashboard {
  balance: number;
  roi_pct: number;
  win_rate_pct: number;
  wins: number;
  losses: number;
  void_count: number;
  open_bets_count: number;
  open_stake_amount: number;
  history: LedgerEntry[];
}

interface StakingRule {
  strategy: string;
  max_stake_pct: number;
  daily_loss_stop: number | null;
  auto_suggest_from_confidence: boolean;
}

const RANGES = ["30D", "90D", "All"] as const;
type Range = (typeof RANGES)[number];
const RANGE_DAYS: Record<Range, number | null> = { "30D": 30, "90D": 90, All: null };

export default function BankrollPage() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [bets, setBets] = useState<Bet[]>([]);
  const [rule, setRule] = useState<StakingRule | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<Range>("30D");

  const [settlingIds, setSettlingIds] = useState<Set<number>>(new Set());
  const [settleError, setSettleError] = useState<string | null>(null);

  const [logOpen, setLogOpen] = useState(false);
  const [logMarket, setLogMarket] = useState("");
  const [logStake, setLogStake] = useState("");
  const [logOdds, setLogOdds] = useState("");
  const [logging, setLogging] = useState(false);
  const [logError, setLogError] = useState<string | null>(null);

  const [ledgerType, setLedgerType] = useState<"deposit" | "withdrawal">("deposit");
  const [ledgerAmount, setLedgerAmount] = useState("");
  const [ledgerBusy, setLedgerBusy] = useState(false);
  const [ledgerError, setLedgerError] = useState<string | null>(null);

  const [ruleForm, setRuleForm] = useState({ max_stake_pct: "5", daily_loss_stop: "" });
  const [savingRule, setSavingRule] = useState(false);

  async function loadAll() {
    const [d, b, r] = await Promise.all([
      api.get<Dashboard>("/bankroll/dashboard"),
      api.get<Bet[]>("/bankroll/bets"),
      api.get<StakingRule>("/bankroll/staking-rule"),
    ]);
    setDashboard(d);
    setBets(b);
    setRule(r);
    setRuleForm({ max_stake_pct: String(r.max_stake_pct), daily_loss_stop: r.daily_loss_stop != null ? String(r.daily_loss_stop) : "" });
  }

  useEffect(() => {
    loadAll().finally(() => setLoading(false));
  }, []);

  async function settleBet(id: number, status: "won" | "lost" | "void") {
    setSettlingIds((prev) => new Set(prev).add(id));
    setSettleError(null);
    try {
      await api.post(`/bankroll/bets/${id}/settle`, { status });
      await loadAll();
    } catch (err) {
      setSettleError(err instanceof ApiError ? err.message : "Couldn't settle that bet.");
    } finally {
      setSettlingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  async function logBet() {
    if (!logMarket.trim() || !logStake || !logOdds || logging) return;
    setLogging(true);
    setLogError(null);
    try {
      await api.post("/bankroll/bets", { market: logMarket, stake: Number(logStake), odds: Number(logOdds) });
      setLogMarket("");
      setLogStake("");
      setLogOdds("");
      setLogOpen(false);
      await loadAll();
    } catch (err) {
      setLogError(err instanceof ApiError ? err.message : "Couldn't log that bet.");
    } finally {
      setLogging(false);
    }
  }

  async function addLedgerEntry() {
    if (!ledgerAmount || ledgerBusy) return;
    setLedgerBusy(true);
    setLedgerError(null);
    try {
      await api.post("/bankroll/ledger", { transaction_type: ledgerType, amount: Number(ledgerAmount) });
      setLedgerAmount("");
      await loadAll();
    } catch (err) {
      setLedgerError(err instanceof ApiError ? err.message : "Couldn't record that.");
    } finally {
      setLedgerBusy(false);
    }
  }

  async function saveRule() {
    if (savingRule) return;
    setSavingRule(true);
    try {
      const updated = await api.put<StakingRule>("/bankroll/staking-rule", {
        max_stake_pct: Number(ruleForm.max_stake_pct),
        daily_loss_stop: ruleForm.daily_loss_stop ? Number(ruleForm.daily_loss_stop) : null,
      });
      setRule(updated);
    } finally {
      setSavingRule(false);
    }
  }

  async function toggleAutoSuggest() {
    if (!rule) return;
    const updated = await api.put<StakingRule>("/bankroll/staking-rule", { auto_suggest_from_confidence: !rule.auto_suggest_from_confidence });
    setRule(updated);
  }

  const history = dashboard?.history ?? [];
  const days = RANGE_DAYS[range];
  const cutoff = days != null ? Date.now() - days * 86400000 : null;
  const filteredHistory = cutoff != null ? history.filter((h) => new Date(h.created_at).getTime() >= cutoff) : history;
  const chartHistory = filteredHistory.length > 0 ? filteredHistory : history.slice(-1);

  return (
    <div className="p-9 flex flex-col gap-[22px]">
      <div className="flex flex-col gap-1">
        <span className="text-[11px] tracking-wider uppercase" style={{ color: "var(--text-3)" }}>Bankroll</span>
        <h1 className="tr7-display text-[26px] font-bold m-0">Control</h1>
      </div>

      {loading ? (
        <span className="text-sm" style={{ color: "var(--text-2)" }}>Loading...</span>
      ) : dashboard ? (
        <>
          <div className="flex gap-4">
            <StatTile label="Bankroll balance" value={`$${dashboard.balance.toFixed(2)}`} sub={`${dashboard.wins + dashboard.losses + dashboard.void_count} bets settled`} />
            <StatTile label="ROI" value={`${dashboard.roi_pct.toFixed(1)}%`} sub="On settled bets" subTone={dashboard.roi_pct >= 0 ? "positive" : undefined} />
            <StatTile label="Win rate" value={`${dashboard.win_rate_pct.toFixed(0)}%`} sub={`${dashboard.wins}W – ${dashboard.losses}L`} />
            <StatTile label="Open bets" value={String(dashboard.open_bets_count)} valueTone="accent" sub={`$${dashboard.open_stake_amount.toFixed(2)} at risk`} />
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
            {chartHistory.length >= 2 ? (
              <BankrollChart history={chartHistory} />
            ) : (
              <div className="h-[180px] flex items-center justify-center text-xs" style={{ color: "var(--text-3)" }}>
                {history.length === 0 ? "No ledger activity yet — record a deposit to get started." : "Not enough activity in this range yet."}
              </div>
            )}
          </div>

          <div className="tr7-card p-4 flex flex-col gap-3">
            <span className="text-[13px] font-semibold">Record a deposit or withdrawal</span>
            <div className="flex items-center gap-2">
              <div className="flex gap-1 p-[3px] rounded-lg border" style={{ background: "var(--bg)", borderColor: "var(--border)" }}>
                {(["deposit", "withdrawal"] as const).map((t) => (
                  <button key={t} onClick={() => setLedgerType(t)} className="px-3 py-1.5 rounded-md text-[11.5px] font-medium cursor-pointer capitalize" style={{ background: ledgerType === t ? "var(--surface-2)" : "transparent", color: ledgerType === t ? "var(--text)" : "var(--text-3)" }}>
                    {t}
                  </button>
                ))}
              </div>
              <input value={ledgerAmount} onChange={(e) => setLedgerAmount(e.target.value)} type="number" min="0" step="0.01" placeholder="Amount" className="rounded-[10px] border px-3 py-2 text-[13px] tr7-mono outline-none w-[140px]" style={{ background: "var(--bg)", borderColor: "var(--border)", color: "var(--text)" }} />
              <button onClick={addLedgerEntry} disabled={!ledgerAmount || ledgerBusy} className="tr7-btn-primary cursor-pointer disabled:opacity-50">
                {ledgerBusy ? "Saving..." : "Save"}
              </button>
            </div>
            {ledgerError && <span className="text-xs" style={{ color: "var(--danger)" }}>{ledgerError}</span>}
          </div>

          <div className="flex gap-5 items-start">
            <div className="flex-1 tr7-card pt-5 pb-1.5 flex flex-col">
              <div className="flex items-center justify-between px-[22px] pb-3.5">
                <span className="text-[13px] font-semibold">Bet history</span>
                <button onClick={() => setLogOpen((v) => !v)} className="text-[11.5px] rounded-lg border px-2.5 py-1.5 cursor-pointer" style={{ borderColor: "var(--border-2)", color: "var(--text-2)" }}>
                  {logOpen ? "Cancel" : "+ Log bet"}
                </button>
              </div>

              {logOpen && (
                <div className="flex flex-col gap-2 px-[22px] pb-4">
                  <div className="flex gap-2">
                    <input value={logMarket} onChange={(e) => setLogMarket(e.target.value)} placeholder="Market (e.g. 1X2)" className="flex-1 rounded-[10px] border px-3 py-2 text-[13px] outline-none" style={{ background: "var(--bg)", borderColor: "var(--border)", color: "var(--text)" }} />
                    <input value={logStake} onChange={(e) => setLogStake(e.target.value)} type="number" min="0" step="0.01" placeholder="Stake" className="w-[110px] rounded-[10px] border px-3 py-2 text-[13px] tr7-mono outline-none" style={{ background: "var(--bg)", borderColor: "var(--border)", color: "var(--text)" }} />
                    <input value={logOdds} onChange={(e) => setLogOdds(e.target.value)} type="number" min="1.01" step="0.01" placeholder="Odds" className="w-[100px] rounded-[10px] border px-3 py-2 text-[13px] tr7-mono outline-none" style={{ background: "var(--bg)", borderColor: "var(--border)", color: "var(--text)" }} />
                    <button onClick={logBet} disabled={!logMarket.trim() || !logStake || !logOdds || logging} className="tr7-btn-primary cursor-pointer disabled:opacity-50">
                      {logging ? "Saving..." : "Save"}
                    </button>
                  </div>
                  {logError && <span className="text-xs" style={{ color: "var(--danger)" }}>{logError}</span>}
                </div>
              )}

              <div className="grid gap-2 px-[22px] py-2 text-[10.5px] uppercase tracking-wider border-y" style={{ gridTemplateColumns: "2.2fr 1.1fr 0.9fr 0.9fr 1.1fr 0.9fr", borderColor: "var(--surface-2)", color: "var(--text-3)" }}>
                <span>Match / market</span>
                <span>Market</span>
                <span>Stake</span>
                <span>Odds</span>
                <span>Result</span>
                <span className="text-right">P&amp;L</span>
              </div>
              {bets.length === 0 ? (
                <span className="text-xs px-[22px] py-6" style={{ color: "var(--text-3)" }}>No bets logged yet.</span>
              ) : (
                bets.map((b, i) => {
                  const settling = settlingIds.has(b.id);
                  return (
                    <div key={b.id} className={`grid gap-2 px-[22px] py-3 items-center text-[12.5px] ${i < bets.length - 1 ? "border-b" : ""}`} style={{ gridTemplateColumns: "2.2fr 1.1fr 0.9fr 0.9fr 1.1fr 0.9fr", borderColor: "#201911" }}>
                      <span>{b.match_label ?? "Manual entry"}</span>
                      <span style={{ color: "var(--text-2)" }}>{b.market}</span>
                      <span className="tr7-mono">${b.stake.toFixed(2)}</span>
                      <span className="tr7-mono">{b.odds.toFixed(2)}</span>
                      {b.status === "pending" ? (
                        <div className="flex gap-1">
                          <button onClick={() => settleBet(b.id, "won")} disabled={settling} className="text-[10px] rounded-md px-1.5 py-1 cursor-pointer disabled:opacity-50" style={{ color: "var(--positive)", background: "var(--positive-bg)" }}>Won</button>
                          <button onClick={() => settleBet(b.id, "lost")} disabled={settling} className="text-[10px] rounded-md px-1.5 py-1 cursor-pointer disabled:opacity-50" style={{ color: "var(--danger)", background: "var(--danger-bg)" }}>Lost</button>
                          <button onClick={() => settleBet(b.id, "void")} disabled={settling} className="text-[10px] rounded-md px-1.5 py-1 cursor-pointer disabled:opacity-50" style={{ color: "var(--text-2)", background: "var(--bg)" }}>Void</button>
                        </div>
                      ) : (
                        <Pill tone={b.status === "won" ? "positive" : b.status === "lost" ? "danger" : "neutral"}>
                          {b.status === "won" ? "Won" : b.status === "lost" ? "Lost" : "Void"}
                        </Pill>
                      )}
                      <span className="tr7-mono text-right" style={{ color: b.pl == null ? "var(--text-3)" : b.pl > 0 ? "var(--positive)" : b.pl < 0 ? "var(--danger)" : "var(--text-2)" }}>
                        {b.pl == null ? "—" : `${b.pl > 0 ? "+" : ""}$${b.pl.toFixed(2)}`}
                      </span>
                    </div>
                  );
                })
              )}
              {settleError && <span className="text-xs px-[22px] py-2" style={{ color: "var(--danger)" }}>{settleError}</span>}
            </div>

            <div className="w-[340px] shrink-0 tr7-card p-5 flex flex-col gap-4">
              <span className="text-[13px] font-semibold">Staking rules</span>
              <span className="text-[11px] -mt-2" style={{ color: "var(--text-3)" }}>
                Quarter-Kelly is the only sizing strategy the engine implements — these fields set the ceiling it enforces on top of that suggestion (§6).
              </span>

              <Field label="Max stake per bet" value={ruleForm.max_stake_pct} unit="% of bankroll" onChange={(v) => setRuleForm((f) => ({ ...f, max_stake_pct: v }))} />
              <Field label="Daily loss stop" value={ruleForm.daily_loss_stop} unit="$" placeholder="No limit" onChange={(v) => setRuleForm((f) => ({ ...f, daily_loss_stop: v }))} />
              <button onClick={saveRule} disabled={savingRule} className="tr7-btn-primary cursor-pointer disabled:opacity-50 self-start">
                {savingRule ? "Saving..." : "Save limits"}
              </button>

              {rule && (
                <div className="flex items-center justify-between pt-1.5 border-t" style={{ borderColor: "var(--surface-2)" }}>
                  <span className="text-xs" style={{ color: "var(--text)" }}>Auto-suggest stake from confidence</span>
                  <button onClick={toggleAutoSuggest} className="w-[34px] h-5 rounded-full flex p-0.5 box-border cursor-pointer border-none" style={{ background: rule.auto_suggest_from_confidence ? "var(--positive)" : "var(--surface-2)", justifyContent: rule.auto_suggest_from_confidence ? "flex-end" : "flex-start" }}>
                    <div className="w-4 h-4 rounded-full" style={{ background: "var(--bg)" }} />
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

function BankrollChart({ history }: { history: LedgerEntry[] }) {
  const width = 1160;
  const height = 200;
  const values = history.map((h) => h.balance_after);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = history
    .map((h, i) => {
      const x = (i / (history.length - 1)) * width;
      const y = height - 20 - ((h.balance_after - min) / span) * (height - 40);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const first = new Date(history[0].created_at);
  const last = new Date(history[history.length - 1].created_at);
  const fmt = (d: Date) => d.toLocaleDateString(undefined, { day: "2-digit", month: "short" });

  return (
    <>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-[180px]" preserveAspectRatio="none">
        <line x1="0" y1="40" x2={width} y2="40" stroke="var(--surface-2)" />
        <line x1="0" y1="100" x2={width} y2="100" stroke="var(--surface-2)" />
        <line x1="0" y1="160" x2={width} y2="160" stroke="var(--surface-2)" />
        <path d={`M${points.split(" ").join(" L")} L${width},${height} L0,${height} Z`} fill="var(--positive)" fillOpacity={0.12} stroke="none" />
        <polyline points={points} fill="none" stroke="var(--positive)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div className="flex justify-between px-0.5">
        <span className="tr7-mono text-[10.5px]" style={{ color: "var(--text-3)" }}>{fmt(first)}</span>
        <span className="tr7-mono text-[10.5px]" style={{ color: "var(--text-3)" }}>{fmt(last)}</span>
      </div>
    </>
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

function Field({ label, value, unit, placeholder, onChange }: { label: string; value: string; unit: string; placeholder?: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11.5px]" style={{ color: "var(--text-2)" }}>{label}</span>
      <div className="rounded-[10px] border px-3 py-2 flex items-center gap-1.5" style={{ background: "var(--bg)", borderColor: "var(--border)" }}>
        <input value={value} onChange={(e) => onChange(e.target.value)} type="number" min="0" step="0.1" placeholder={placeholder} className="tr7-mono text-[13px] outline-none bg-transparent border-none w-full" style={{ color: "var(--text)" }} />
        <span className="tr7-mono text-[11.5px]" style={{ color: "var(--text-3)" }}>{unit}</span>
      </div>
    </div>
  );
}
