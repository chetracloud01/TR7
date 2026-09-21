from datetime import datetime

from pydantic import BaseModel


class LedgerEntryOut(BaseModel):
    id: int
    transaction_type: str
    amount: float
    balance_after: float
    related_bet_id: int | None
    created_at: datetime

    model_config = {"from_attributes": True}


class LedgerCreate(BaseModel):
    transaction_type: str  # deposit | withdrawal
    amount: float


class BetOut(BaseModel):
    id: int
    match_id: int | None
    match_label: str | None
    prediction_id: int | None
    market: str
    stake: float
    odds: float
    potential_return: float
    status: str  # pending | won | lost | void
    pl: float | None
    placed_at: datetime
    settled_at: datetime | None


class BetCreate(BaseModel):
    market: str
    stake: float
    odds: float
    match_id: int | None = None
    prediction_id: int | None = None


class BetSettle(BaseModel):
    status: str  # won | lost | void


class StakeSuggestionOut(BaseModel):
    pct: float
    amount: float


class StakingRuleOut(BaseModel):
    strategy: str
    max_stake_pct: float
    daily_loss_stop: float | None
    auto_suggest_from_confidence: bool

    model_config = {"from_attributes": True}


class StakingRuleUpdate(BaseModel):
    strategy: str | None = None
    max_stake_pct: float | None = None
    daily_loss_stop: float | None = None
    auto_suggest_from_confidence: bool | None = None


class DashboardOut(BaseModel):
    balance: float
    roi_pct: float
    win_rate_pct: float
    wins: int
    losses: int
    void_count: int
    open_bets_count: int
    open_stake_amount: float
    history: list[LedgerEntryOut]
