"""The research call's prompt — Master Script §3/§4/§7. Asks the model to
do the parts that genuinely need judgment (a scoreline estimate, the six
context rules, a few qualitative confidence factors) and return them as
JSON so the deterministic layer (odds.py/confidence.py/staking.py) can
do the arithmetic.

No real web search or stats feed is wired up (docs/MASTER_PLAN.md §5.2
upgrade 2 — future work), so this is the model's own reasoning, not
grounded in live data — the UI should make that clear, not present it as
verified research."""

SYSTEM_PROMPT = """You are a football (soccer) analyst helping evaluate a betting pick. \
You will be given one fixture, the market's 1X2 odds, and someone else's predicted \
scoreline. Give your own independent read.

Respond with ONLY a single JSON object, no prose before or after, no markdown code \
fence, matching exactly this shape:

{
  "correct_score": "2-1",
  "raw_prob_pct": 72,
  "btts": true,
  "over_under": "OVER",
  "handicap_line": "-1",
  "rationale": "1-2 sentences, concrete, citing form/injuries/matchup reasoning.",
  "home_team_country": "England",
  "away_team_country": "England",
  "rules": {
    "R1_aggregate_lead": {"fired": false, "note": "n/a, not a two-leg tie"},
    "R2_dead_rubber": {"fired": false, "note": "n/a"},
    "R3_rotation": {"fired": false, "note": "no rotation news found"},
    "R5_level_tie_home_win": {"fired": false, "note": "n/a"},
    "R6_consensus": {"fired": true, "note": "your read on whether independent sources would likely agree"}
  },
  "factors": {"form": 1, "injuries": 1, "source_agreement": 1}
}

Field notes:
- raw_prob_pct: your probability (0-100) that YOUR predicted side (from correct_score) wins.
- handicap_line: the Asian Handicap line your scoreline's margin actually supports, or null if margin is 0.
- rules: apply Master Script R1 (either side leads 2+ on aggregate — only relevant for a two-leg tie), \
R2 (either side already eliminated or already through), R3 (the stronger side likely fields a weakened \
lineup), R5 (aggregate level + strong home form favours a straightforward home win). R6 is your own \
estimate of whether independent analysis would converge on your pick.
- factors: each 0, 1, or 2 — how many "points" (Master Script §7) that factor deserves given what you know.
- home_team_country/away_team_country: the country each club is actually based in (not the competition's \
country/region) — leave as your best real-world knowledge, a short country name.
- Never fabricate a specific stat, injury, or news item you're not confident about — keep the rationale \
grounded in what you'd genuinely expect to be true, and say so if you're inferring from team quality alone."""


def build_user_prompt(
    *, home_team: str, away_team: str, competition: str, competition_country: str, kickoff_raw: str,
    odds_home: float, odds_draw: float, odds_away: float, app_predicted_score: str,
) -> str:
    return (
        f"Fixture: {home_team} vs {away_team}\n"
        f"Competition: {competition} ({competition_country})\n"
        f"Kickoff (ICT): {kickoff_raw}\n"
        f"Market odds (1X2): {odds_home} / {odds_draw} / {odds_away}\n"
        f'Another source\'s predicted score: "{app_predicted_score}"\n\n'
        "Give your own independent prediction as the JSON object described above."
    )
