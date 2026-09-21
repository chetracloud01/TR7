"""Correct-score cascade — Master Script §1D. A predicted scoreline is
never staked directly; it's decomposed into what it actually supports."""

from dataclasses import dataclass


@dataclass
class Cascade:
    margin: int
    btts: bool
    over_under: str  # "OVER" | "UNDER"
    handicap_note: str


def derive_cascade(score: str) -> Cascade | None:
    parts = score.replace("–", "-").replace("—", "-").split("-")
    if len(parts) != 2:
        return None
    try:
        home, away = int(parts[0].strip()), int(parts[1].strip())
    except ValueError:
        return None

    margin = abs(home - away)
    btts = home > 0 and away > 0
    over_under = "OVER" if home + away >= 3 else "UNDER"

    if margin == 0:
        note = "No handicap value either side — consider Draw No Bet instead."
    elif margin == 1:
        note = "Only -0.5 / -1 on the favoured side has value. Avoid -1.5+."
    elif margin == 2:
        note = "-1 / -1.5 may have value. Avoid -2+."
    else:
        note = "-1.5 / -2 / -2.5 may have value — still confirm with research."

    return Cascade(margin=margin, btts=btts, over_under=over_under, handicap_note=note)


def winner(score: str) -> str:
    """"1" (home), "X" (draw), or "2" (away) from a scoreline."""
    parts = score.replace("–", "-").replace("—", "-").split("-")
    home, away = int(parts[0].strip()), int(parts[1].strip())
    if home > away:
        return "1"
    if away > home:
        return "2"
    return "X"
