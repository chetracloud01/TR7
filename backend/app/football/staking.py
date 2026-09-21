"""Quarter-Kelly, capped by the staking rule's max, then halved for HIGH
risk (Master Script §7B: a fragile-but-high-star pick stakes at half its
tier)."""

from dataclasses import dataclass


@dataclass
class StakeSuggestion:
    pct: float
    amount: float


def suggested_stake(prob_pct: float, odd: float, risk_tier: str, bankroll: float, max_stake_pct: float = 5.0) -> StakeSuggestion:
    p = prob_pct / 100
    b = odd - 1
    full_kelly = max(0.0, (p * b - (1 - p)) / b) if b > 0 else 0.0
    pct = min(full_kelly * 0.25 * 100, max_stake_pct)
    if risk_tier == "high":
        pct /= 2
    return StakeSuggestion(pct=round(pct, 2), amount=round(bankroll * pct / 100, 2))
