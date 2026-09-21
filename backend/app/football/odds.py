"""Pure odds math — no LLM, no external data, just arithmetic."""


def implied_probabilities(odds_home: float, odds_draw: float, odds_away: float) -> tuple[float, float, float]:
    """Market-implied win probabilities (%), removing the bookmaker's
    overround so the three sum to 100 — this is what "the App" effectively
    is in our input format (§1E gives odds, not a separately-stated
    confidence), so App EV is always ~0 by construction; the real
    question this app answers is "where does my model diverge from the
    market," not App vs. a second stated opinion."""
    raw = [1 / odds_home, 1 / odds_draw, 1 / odds_away]
    total = sum(raw)
    return tuple(round(r / total * 100, 1) for r in raw)  # type: ignore[return-value]


def ev(prob_pct: float, odd: float) -> float:
    """Expected value as a fraction, e.g. 0.129 = +12.9%."""
    return (prob_pct / 100) * odd - 1
