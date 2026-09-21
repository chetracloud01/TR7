"""Bankroll module core logic — docs/MASTER_PLAN.md §6.

The ledger is append-only: current balance is always derived from the
latest entry's balance_after, never tracked as a separate mutable
counter, so it stays auditable against the entry history.
"""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models.bankroll import BankrollLedger, StakingRule


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


def get_or_create_staking_rule(db: Session, user_id: int) -> StakingRule:
    rule = db.scalar(select(StakingRule).where(StakingRule.user_id == user_id))
    if rule is None:
        rule = StakingRule(user_id=user_id)
        db.add(rule)
        db.flush()
    return rule
