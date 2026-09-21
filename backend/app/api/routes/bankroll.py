"""Bankroll module — docs/MASTER_PLAN.md §6. Ledger is append-only;
balance is always derived from it (app.bankroll.service). Bet sizing
for a prediction-sourced bet reuses the Football Prediction module's
Kelly + risk-tier suggestion (app.football.staking) and this module
only enforces the staking-rule ceiling on top of it."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from collections import defaultdict

from app.bankroll.service import apply_settlement, current_balance, get_or_create_staking_rule, record_ledger_entry
from app.core.deps import get_current_user
from app.db.models.bankroll import BankrollLedger, Bet, StakingRule
from app.db.models.football import Match, Prediction, ResearchPrediction, RiskFlag
from app.db.models.user import User
from app.db.session import get_db
from app.football.staking import suggested_stake
from app.schemas.bankroll import (
    BetCreate,
    BetOut,
    BetSettle,
    BreakdownRow,
    DashboardOut,
    LedgerCreate,
    LedgerEntryOut,
    StakeSuggestionOut,
    StakingRuleOut,
    StakingRuleUpdate,
)

router = APIRouter()

VALID_TRANSACTION_TYPES = {"deposit", "withdrawal"}
VALID_SETTLE_STATUSES = {"won", "lost", "void"}


def _match_label(match: Match | None) -> str | None:
    return f"{match.home_team} vs {match.away_team}" if match else None


def _to_bet_out(bet: Bet, match: Match | None = None) -> BetOut:
    pl: float | None = None
    if bet.status == "won":
        pl = round(bet.potential_return - bet.stake, 2)
    elif bet.status == "lost":
        pl = -bet.stake
    elif bet.status == "void":
        pl = 0.0

    return BetOut(
        id=bet.id,
        match_id=bet.match_id,
        match_label=_match_label(match),
        prediction_id=bet.prediction_id,
        market=bet.market,
        stake=bet.stake,
        odds=bet.odds,
        potential_return=bet.potential_return,
        status=bet.status,
        pl=pl,
        placed_at=bet.placed_at,
        settled_at=bet.settled_at,
    )


def _get_owned_bet(bet_id: int, user: User, db: Session) -> Bet:
    bet = db.get(Bet, bet_id)
    if bet is None or bet.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bet not found")
    return bet


def _compute_stake_suggestion(db: Session, user: User, match: Match) -> tuple[Prediction, StakeSuggestionOut]:
    pred = db.scalar(select(Prediction).where(Prediction.match_id == match.id))
    risk = db.scalar(select(RiskFlag).where(RiskFlag.match_id == match.id))
    if pred is None or pred.final_tip is None or pred.final_prob is None or pred.final_odd is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This match has no finalized prediction yet — run research first.")
    if risk is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This match has no risk tier yet — run research first.")

    balance = current_balance(db, user.id)
    rule = get_or_create_staking_rule(db, user.id)
    # rule.max_stake_pct is the ceiling this module enforces on top of the
    # Football Prediction module's own Kelly + risk-tier suggestion (§6).
    stake = suggested_stake(pred.final_prob, pred.final_odd, risk.risk_tier, balance, max_stake_pct=rule.max_stake_pct)
    return pred, StakeSuggestionOut(pct=stake.pct, amount=stake.amount)


def _bet_pl(bet: Bet) -> float:
    if bet.status == "won":
        return bet.potential_return - bet.stake
    if bet.status == "lost":
        return -bet.stake
    return 0.0  # pending or void


def _breakdown(rows: dict[str, dict[str, float]]) -> list[BreakdownRow]:
    return sorted(
        (BreakdownRow(label=label, count=int(v["count"]), staked=round(v["staked"], 2), pl=round(v["pl"], 2)) for label, v in rows.items()),
        key=lambda r: r.pl,
        reverse=True,
    )


@router.get("/bankroll/dashboard", response_model=DashboardOut)
def get_dashboard(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> DashboardOut:
    balance = current_balance(db, user.id)
    bets = db.scalars(select(Bet).where(Bet.user_id == user.id)).all()

    settled = [b for b in bets if b.status in ("won", "lost", "void")]
    wins = sum(1 for b in settled if b.status == "won")
    losses = sum(1 for b in settled if b.status == "lost")
    voids = sum(1 for b in settled if b.status == "void")
    decided = wins + losses

    total_staked = sum(b.stake for b in settled if b.status != "void")
    total_pl = sum(_bet_pl(b) for b in settled)

    open_bets = [b for b in bets if b.status == "pending"]

    history = db.scalars(select(BankrollLedger).where(BankrollLedger.user_id == user.id).order_by(BankrollLedger.id)).all()

    # Breakdowns cover decided bets only (won/lost) — a void bet has no
    # real P&L signal to attribute to a market, league, or model.
    by_market: dict[str, dict[str, float]] = defaultdict(lambda: {"count": 0, "staked": 0.0, "pl": 0.0})
    by_league: dict[str, dict[str, float]] = defaultdict(lambda: {"count": 0, "staked": 0.0, "pl": 0.0})
    by_model: dict[str, dict[str, float]] = defaultdict(lambda: {"count": 0, "staked": 0.0, "pl": 0.0})

    for b in settled:
        if b.status == "void":
            continue
        pl = _bet_pl(b)

        row = by_market[b.market]
        row["count"] += 1
        row["staked"] += b.stake
        row["pl"] += pl

        if b.match_id is not None:
            match = db.get(Match, b.match_id)
            if match is not None:
                row = by_league[match.competition]
                row["count"] += 1
                row["staked"] += b.stake
                row["pl"] += pl

        if b.prediction_id is not None and b.match_id is not None:
            research = db.scalar(
                select(ResearchPrediction).where(ResearchPrediction.match_id == b.match_id).order_by(ResearchPrediction.id.desc())
            )
            if research is not None:
                row = by_model[research.model_used]
                row["count"] += 1
                row["staked"] += b.stake
                row["pl"] += pl

    return DashboardOut(
        balance=balance,
        roi_pct=round(total_pl / total_staked * 100, 2) if total_staked else 0.0,
        win_rate_pct=round(wins / decided * 100, 2) if decided else 0.0,
        wins=wins,
        losses=losses,
        void_count=voids,
        open_bets_count=len(open_bets),
        open_stake_amount=round(sum(b.stake for b in open_bets), 2),
        history=[LedgerEntryOut.model_validate(e) for e in history],
        by_market=_breakdown(by_market),
        by_league=_breakdown(by_league),
        by_model=_breakdown(by_model),
    )


@router.get("/bankroll/bets", response_model=list[BetOut])
def list_bets(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[BetOut]:
    bets = db.scalars(select(Bet).where(Bet.user_id == user.id).order_by(Bet.id.desc())).all()
    out = []
    for bet in bets:
        match = db.get(Match, bet.match_id) if bet.match_id else None
        out.append(_to_bet_out(bet, match))
    return out


@router.post("/bankroll/bets", response_model=BetOut)
def create_bet(payload: BetCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> BetOut:
    if payload.stake <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Stake must be positive.")
    if payload.odds <= 1:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Odds must be greater than 1.")

    match = None
    if payload.match_id is not None:
        match = db.get(Match, payload.match_id)
        if match is None or match.batch.user_id != user.id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Match not found")

    bet = Bet(
        user_id=user.id,
        match_id=payload.match_id,
        prediction_id=payload.prediction_id,
        market=payload.market,
        stake=payload.stake,
        odds=payload.odds,
        potential_return=round(payload.stake * payload.odds, 2),
        status="pending",
    )
    db.add(bet)
    db.flush()
    record_ledger_entry(db, user.id, transaction_type="bet_stake", amount=-payload.stake, related_bet_id=bet.id)

    db.commit()
    db.refresh(bet)
    return _to_bet_out(bet, match)


@router.get("/bankroll/matches/{match_id}/stake-suggestion", response_model=StakeSuggestionOut)
def get_stake_suggestion(match_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> StakeSuggestionOut:
    match = db.get(Match, match_id)
    if match is None or match.batch.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Match not found")
    _, suggestion = _compute_stake_suggestion(db, user, match)
    return suggestion


@router.post("/bankroll/matches/{match_id}/bet", response_model=BetOut)
def place_bet_from_prediction(match_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> BetOut:
    match = db.get(Match, match_id)
    if match is None or match.batch.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Match not found")

    existing = db.scalar(select(Bet).where(Bet.match_id == match.id, Bet.status == "pending"))
    if existing is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A pending bet already exists for this match.")

    pred, suggestion = _compute_stake_suggestion(db, user, match)
    if suggestion.amount <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Suggested stake is zero — bankroll balance may be too low.")

    bet = Bet(
        user_id=user.id,
        match_id=match.id,
        prediction_id=pred.id,
        market="1X2",
        stake=suggestion.amount,
        odds=pred.final_odd,
        potential_return=round(suggestion.amount * pred.final_odd, 2),
        status="pending",
    )
    db.add(bet)
    db.flush()
    record_ledger_entry(db, user.id, transaction_type="bet_stake", amount=-suggestion.amount, related_bet_id=bet.id)

    db.commit()
    db.refresh(bet)
    return _to_bet_out(bet, match)


@router.post("/bankroll/bets/{bet_id}/settle", response_model=BetOut)
def settle_bet(bet_id: int, payload: BetSettle, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> BetOut:
    if payload.status not in VALID_SETTLE_STATUSES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"status must be one of {sorted(VALID_SETTLE_STATUSES)}")

    bet = _get_owned_bet(bet_id, user, db)
    if bet.status != "pending":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Bet is already settled.")

    apply_settlement(db, bet, payload.status)

    db.commit()
    db.refresh(bet)
    match = db.get(Match, bet.match_id) if bet.match_id else None
    return _to_bet_out(bet, match)


@router.get("/bankroll/ledger", response_model=list[LedgerEntryOut])
def list_ledger(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[LedgerEntryOut]:
    entries = db.scalars(select(BankrollLedger).where(BankrollLedger.user_id == user.id).order_by(BankrollLedger.id.desc())).all()
    return [LedgerEntryOut.model_validate(e) for e in entries]


@router.post("/bankroll/ledger", response_model=LedgerEntryOut)
def create_ledger_entry(payload: LedgerCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> LedgerEntryOut:
    if payload.transaction_type not in VALID_TRANSACTION_TYPES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"transaction_type must be one of {sorted(VALID_TRANSACTION_TYPES)}")
    if payload.amount <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Amount must be positive.")

    signed = payload.amount if payload.transaction_type == "deposit" else -payload.amount
    balance = current_balance(db, user.id)
    if payload.transaction_type == "withdrawal" and payload.amount > balance:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Withdrawal exceeds current balance.")

    entry = record_ledger_entry(db, user.id, transaction_type=payload.transaction_type, amount=signed)
    db.commit()
    db.refresh(entry)
    return LedgerEntryOut.model_validate(entry)


@router.get("/bankroll/staking-rule", response_model=StakingRuleOut)
def get_staking_rule(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> StakingRuleOut:
    rule = get_or_create_staking_rule(db, user.id)
    db.commit()
    return StakingRuleOut.model_validate(rule)


@router.put("/bankroll/staking-rule", response_model=StakingRuleOut)
def update_staking_rule(payload: StakingRuleUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> StakingRuleOut:
    rule = get_or_create_staking_rule(db, user.id)
    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(rule, field, value)
    db.commit()
    db.refresh(rule)
    return StakingRuleOut.model_validate(rule)
