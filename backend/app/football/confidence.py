"""8-factor confidence scoring -> stars — Master Script §7. Four factors
are pure arithmetic on numbers this app already has; the other four
(form, injuries, source agreement, and the rules count that feeds
"context rules") come from the research LLM's own qualitative read,
since no real stats/news feed is wired up yet (docs/MASTER_PLAN.md §5.2
upgrade 2 — future work)."""

from dataclasses import dataclass

FACTOR_LABELS = ["EV size", "Edge over implied", "Odd quality", "Context rules", "Form (last 5)", "Draw risk", "Injuries", "Source agreement"]

_STAR_TIERS = [(13, 16, 5), (10, 12, 4), (7, 9, 3), (4, 6, 2), (0, 3, 1)]


def score_ev_size(ev_value: float) -> int:
    if ev_value > 0.15:
        return 2
    if ev_value >= 0.05:
        return 1
    return 0


def score_edge(my_prob_pct: float, implied_prob_pct: float) -> int:
    diff = my_prob_pct - implied_prob_pct
    if diff >= 8:
        return 2
    if diff >= 3:
        return 1
    return 0


def score_odd_quality(odd: float) -> int:
    if 1.65 <= odd <= 2.20:
        return 2
    if (1.45 <= odd < 1.65) or (2.20 < odd <= 2.80):
        return 1
    return 0


def score_draw_risk(implied_draw_pct: float) -> int:
    if implied_draw_pct < 20:
        return 2
    if implied_draw_pct <= 30:
        return 1
    return 0


def score_context_rules(fired_count: int) -> int:
    if fired_count == 0:
        return 2
    if fired_count == 1:
        return 1
    return 0


def stars_for_total(total: int) -> int:
    for lo, hi, stars in _STAR_TIERS:
        if lo <= total <= hi:
            return stars
    return 1


@dataclass
class ConfidenceBreakdown:
    points: list[int]  # aligned with FACTOR_LABELS
    total: int
    stars: int


def compute_confidence(
    *, ev_value: float, my_prob_pct: float, implied_prob_pct: float, odd: float, implied_draw_pct: float,
    rules_fired_count: int, form: int, injuries: int, source_agreement: int,
) -> ConfidenceBreakdown:
    points = [
        score_ev_size(ev_value),
        score_edge(my_prob_pct, implied_prob_pct),
        score_odd_quality(odd),
        score_context_rules(rules_fired_count),
        max(0, min(2, form)),
        score_draw_risk(implied_draw_pct),
        max(0, min(2, injuries)),
        max(0, min(2, source_agreement)),
    ]
    total = sum(points)
    return ConfidenceBreakdown(points=points, total=total, stars=stars_for_total(total))
