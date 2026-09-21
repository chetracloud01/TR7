"""Agreement scoring, usage flags, and risk tier — Master Script §5/§7B/§8D."""

from app.football.cascade import winner


def agreement(app_score: str, my_score: str) -> str:
    """"agree" | "partial" | "disagree" by comparing predicted winners."""
    try:
        app_winner, my_winner = winner(app_score), winner(my_score)
    except (ValueError, IndexError):
        return "partial"
    if app_winner == my_winner:
        return "agree"
    if app_winner == "X" or my_winner == "X":
        return "partial"
    return "disagree"


def usage_flag(odd: float, competition: str) -> str | None:
    if odd < 1.40:
        return "banker_only"
    if odd > 3.50:
        return "lottery_odd"
    if "friendly" in competition.lower():
        return "friendly"
    return None


def risk_tier(*, agreement_result: str, rules_fired_count: int, implied_draw_pct: float, odd: float) -> str:
    """The market here is always 1X2 (final_tip is never a handicap pick,
    even though the cascade shows what handicap line the scoreline would
    support) — so risk is driven by rule flags, draw uncertainty, and odd
    quality, not market type (Master Script §7B's own HIGH-risk market
    types don't apply until this app actually recommends a handicap bet)."""
    if rules_fired_count >= 1 or odd > 2.80:
        return "high"
    if agreement_result == "agree" and rules_fired_count == 0 and implied_draw_pct < 20 and odd <= 2.20:
        return "low"
    return "medium"
