export type RiskTier = "LOW" | "MED" | "HIGH";
export type UsageFlag = "BANKER ONLY" | "LOTTERY ODD" | "FRIENDLY LABEL" | "CS MISMATCH" | null;
export type ResultStatus = "won" | "lost" | "pending";

export interface MatchRow {
  id: string;
  kickoffIct: string;
  home: string;
  homeCountry: string;
  away: string;
  awayCountry: string;
  competitionCountry: string;
  competition: string;
  odd: number;
  appCs: string;
  myCs: string;
  result: { score: string | null; status: ResultStatus };
  stars: number;
  risk: RiskTier;
  flag: UsageFlag;
  appProbPct: number;
  myRawProbPct: number;
  myDiscProbPct: number;
  rationale: string;
  consensusNote: string;
}

// Mock batch — stands in for a parsed upload until the LLM Gateway +
// vision extraction (docs/MASTER_PLAN.md §5) is wired up to real input.
export const MATCHES: MatchRow[] = [
  {
    id: "adelaide-tai-po",
    kickoffIct: "17 Sep, 17:00",
    home: "Adelaide United",
    homeCountry: "AUS",
    away: "Tai Po",
    awayCountry: "HKG",
    competitionCountry: "Asia (Intl.)",
    competition: "ACL Two",
    odd: 1.36,
    appCs: "3–1",
    myCs: "2–0",
    result: { score: "3–1", status: "won" },
    stars: 5,
    risk: "LOW",
    flag: "BANKER ONLY",
    appProbPct: 82,
    myRawProbPct: 92,
    myDiscProbPct: 80,
    rationale:
      "Adelaide's home xG (2.1/game, last 6) dwarfs Tai Po's away form. Odd under 1.40 means solid as a banker leg, not a standalone stake.",
    consensusNote: "4 of 4 sources agree — home favourite by a wide margin.",
  },
  {
    id: "man-city-arsenal",
    kickoffIct: "17 Sep, 17:30",
    home: "Man City",
    homeCountry: "ENG",
    away: "Arsenal",
    awayCountry: "ENG",
    competitionCountry: "England",
    competition: "Premier League",
    odd: 1.85,
    appCs: "2–1",
    myCs: "2–1",
    result: { score: null, status: "pending" },
    stars: 4,
    risk: "LOW",
    flag: null,
    appProbPct: 61,
    myRawProbPct: 90,
    myDiscProbPct: 78,
    rationale:
      "City's xG form at home (2.4/game, last 6) and Arsenal's centre-back injuries support a comfortable home win. Draw risk mainly from Arsenal's counter-press.",
    consensusNote: "4 of 4 sources agree — City favoured, some disagreement on margin.",
  },
  {
    id: "newcastle-brighton",
    kickoffIct: "17 Sep, 23:00",
    home: "Newcastle",
    homeCountry: "ENG",
    away: "Brighton",
    awayCountry: "ENG",
    competitionCountry: "England",
    competition: "Premier League",
    odd: 1.95,
    appCs: "2–2",
    myCs: "2–1",
    result: { score: "2–2", status: "won" },
    stars: 4,
    risk: "MED",
    flag: null,
    appProbPct: 52,
    myRawProbPct: 78,
    myDiscProbPct: 68,
    rationale:
      "Both sides leak goals from set pieces this season; BTTS and Over 2.5 both trend strongly across the last 5 meetings.",
    consensusNote: "3 of 4 sources agree on Over 2.5, split on BTTS.",
  },
  {
    id: "sparta-servette",
    kickoffIct: "18 Sep, 01:00",
    home: "Sparta Prague",
    homeCountry: "CZE",
    away: "Servette",
    awayCountry: "SUI",
    competitionCountry: "Europe (Intl.)",
    competition: "Europa League",
    odd: 2.1,
    appCs: "1–1",
    myCs: "1–2",
    result: { score: "0–1", status: "lost" },
    stars: 2,
    risk: "HIGH",
    flag: "CS MISMATCH",
    appProbPct: 44,
    myRawProbPct: 61,
    myDiscProbPct: 53,
    rationale:
      "App's 1-1 call implies a level match, but its own Home -1 Asian Handicap tip needs a 2-goal margin — the two contradict each other. Flagged, not staked.",
    consensusNote: "Sources split — no clean consensus either way.",
  },
  {
    id: "zurich-slavia",
    kickoffIct: "18 Sep, 02:00",
    home: "FC Zurich",
    homeCountry: "SUI",
    away: "Slavia Praha",
    awayCountry: "CZE",
    competitionCountry: "Europe (Intl.)",
    competition: "Conf. League (relabeled)",
    odd: 2.4,
    appCs: "1–0",
    myCs: "2–2",
    result: { score: null, status: "pending" },
    stars: 2,
    risk: "HIGH",
    flag: "FRIENDLY LABEL",
    appProbPct: 48,
    myRawProbPct: 55,
    myDiscProbPct: 48,
    rationale:
      "Source label said 'Friendly' but this is a genuine Conference League qualifier — relabelled after verification. Rotation risk still likely given fixture congestion.",
    consensusNote: "Only 1 of 4 sources has odds posted yet — thin coverage.",
  },
  {
    id: "real-madrid-alaves",
    kickoffIct: "18 Sep, 03:15",
    home: "Real Madrid",
    homeCountry: "ESP",
    away: "Alaves",
    awayCountry: "ESP",
    competitionCountry: "Spain",
    competition: "La Liga",
    odd: 4.2,
    appCs: "4–0",
    myCs: "3–0",
    result: { score: null, status: "pending" },
    stars: 1,
    risk: "HIGH",
    flag: "LOTTERY ODD",
    appProbPct: 78,
    myRawProbPct: 80,
    myDiscProbPct: 70,
    rationale:
      "Heavy favourite, but at 4.20 the market is pricing in real uncertainty (Real Madrid's rotation for a midweek Champions League tie). Speculative leg only.",
    consensusNote: "2 of 4 sources note likely squad rotation.",
  },
];

export function getMatch(id: string) {
  return MATCHES.find((m) => m.id === id);
}
