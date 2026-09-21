"""Bankroll module core logic — docs/MASTER_PLAN.md §6.

The ledger is append-only: current balance is always derived from the
latest entry's balance_after, never tracked as a separate mutable
counter, so it stays auditable against the entry history.
"""

from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models.bankroll import BankrollLedger, Bet, StakingRule


def current_balance(db: Session, user_id: int) -> float:
    latest = db.scalar(
        select(BankrollLedger)
        .where(BankrollLedger.user_id == user_id)
        .order_by(BankrollLedger.id.desc())
        .limit(1)
    )
    return latest.balance_after if latest else 0.0


def record_ledger_entry(
    db: Session,
    user_id: int,
    *,
    transaction_type: str,
    amount: float,
    related_bet_id: int | None = None,
) -> BankrollLedger:
    """`amount` is signed (negative for a stake or withdrawal, positive
    for a deposit or return) — balance_after is the running total after
    applying it."""
    balance_after = round(current_balance(db, user_id) + amount, 2)
    entry = BankrollLedger(
        user_id=user_id,
        transaction_type=transaction_type,
        amount=amount,
        balance_after=balance_after,
        related_bet_id=related_bet_id,
    )
    db.add(entry)
    db.flush()
    return entry


def apply_settlement(db: Session, bet: Bet, outcome: str) -> Bet:
    """Shared by the manual settle endpoint and the Football module's
    auto-settle-on-result path (a bet placed from a match's own
    finalized 1X2 prediction has nothing left to manually grade once
    that match's result is recorded). `outcome` is won|lost|void; a
    no-op if the bet isn't pending."""
    if bet.status != "pending":
        return bet

    bet.status = outcome
    bet.settled_at = datetime.now(UTC).replace(tzinfo=None)

    if outcome == "won":
        record_ledger_entry(db, bet.user_id, transaction_type="bet_return", amount=bet.potential_return, related_bet_id=bet.id)
    elif outcome == "void":
        record_ledger_entry(db, bet.user_id, transaction_type="bet_return", amount=bet.stake, related_bet_id=bet.id)
    # "lost": stake was already deducted at placement, nothing further to record.

    return bet


def get_or_create_staking_rule(db: Session, user_id: int) -> StakingRule:
    rule = db.scalar(select(StakingRule).where(StakingRule.user_id == user_id))
    if rule is None:
        rule = StakingRule(user_id=user_id)
        db.add(rule)
        db.flush()
    return rule
