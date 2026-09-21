/** Small pure helpers behind the Predict module's math — placeholders
 * for the real engine in docs/MASTER_PLAN.md §5. Kept isolated so the
 * eventual backend port is a straight copy, not a rewrite. */

export function ev(probPct: number, odd: number) {
  return (probPct / 100) * odd - 1;
}

export function formatPct(x: number) {
  const pct = x * 100;
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;
}

export interface Cascade {
  margin: number;
  btts: boolean;
  overUnder: "OVER" | "UNDER";
  handicapNote: string;
}

/** Correct-score cascade — §1D of the Master Script: a scoreline is
 * decomposed into BTTS / O-U / the handicap line it actually supports. */
export function deriveCascade(score: string): Cascade {
  const [home, away] = score.split("–").map((n) => Number(n.trim()));
  const margin = Math.abs(home - away);
  const btts = home > 0 && away > 0;
  const overUnder = home + away >= 3 ? "OVER" : "UNDER";

  let handicapNote: string;
  if (margin === 0) handicapNote = "No handicap value either side — consider Draw No Bet instead.";
  else if (margin === 1) handicapNote = "Only -0.5 / -1 on the favoured side has value. Avoid -1.5+.";
  else if (margin === 2) handicapNote = "-1 / -1.5 may have value. Avoid -2+.";
  else handicapNote = "-1.5 / -2 / -2.5 may have value — still confirm with research.";

  return { margin, btts, overUnder, handicapNote };
}

/** Quarter-Kelly stake, capped by the staking rule's max-stake-per-bet,
 * then a HIGH-risk haircut (Master Script §7B: half the tier stake). */
export function suggestedStake(probPct: number, odd: number, risk: "LOW" | "MED" | "HIGH", bankroll: number, maxStakePct = 5) {
  const p = probPct / 100;
  const b = odd - 1;
  const fullKelly = Math.max(0, (p * b - (1 - p)) / b);
  let pct = Math.min(fullKelly * 0.25 * 100, maxStakePct);
  if (risk === "HIGH") pct /= 2;
  return { pct, amount: (bankroll * pct) / 100 };
}

/** 8-factor confidence breakdown (§7) — a deterministic stand-in until
 * each factor is computed from real research; sums to the star tier. */
export function confidenceBreakdown(stars: number) {
  const totalByStars: Record<number, number> = { 5: 14, 4: 11, 3: 8, 2: 5, 1: 2 };
  const total = totalByStars[stars] ?? 8;
  const factors = ["EV size", "Edge over implied", "Odd quality", "Context rules", "Form (last 5)", "Draw risk", "Injuries", "Source agreement"];
  const base = Math.floor(total / 8);
  const extra = total % 8;
  return { total, breakdown: factors.map((label, i) => ({ label, points: Math.min(2, base + (i < extra ? 1 : 0)) })) };
}
