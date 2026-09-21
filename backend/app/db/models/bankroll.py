"""Bankroll module — docs/MASTER_PLAN.md section 6."""

from datetime import date, datetime

from sqlalchemy import JSON, Boolean, Float, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base, TimestampMixin


class Bet(TimestampMixin, Base):
    __tablename__ = "bets"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    match_id: Mapped[int | None] = mapped_column(ForeignKey("matches.id"), nullable=True)
    prediction_id: Mapped[int | None] = mapped_column(ForeignKey("predictions.id"), nullable=True)

    market: Mapped[str] = mapped_column(String(64))
    stake: Mapped[float] = mapped_column(Float)
    odds: Mapped[float] = mapped_column(Float)
    potential_return: Mapped[float] = mapped_column(Float)
    status: Mapped[str] = mapped_column(String(16), default="pending")  # pending|won|lost|void
    placed_at: Mapped[datetime] = mapped_column(server_default=func.now())
    settled_at: Mapped[datetime | None] = mapped_column(nullable=True)

    ledger_entries: Mapped[list["BankrollLedger"]] = relationship(back_populates="bet")


class BankrollLedger(TimestampMixin, Base):
    """Append-only — balance is always derivable/auditable from this,
    never a mutable counter (docs/MASTER_PLAN.md section 6)."""

    __tablename__ = "bankroll_ledger"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))

    transaction_type: Mapped[str] = mapped_column(String(16))  # deposit|withdrawal|bet_stake|bet_return
    amount: Mapped[float] = mapped_column(Float)
    balance_after: Mapped[float] = mapped_column(Float)
    related_bet_id: Mapped[int | None] = mapped_column(ForeignKey("bets.id"), nullable=True)

    bet: Mapped[Bet | None] = relationship(back_populates="ledger_entries")


class StakingRule(Base):
    __tablename__ = "staking_rules"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True)

    strategy: Mapped[str] = mapped_column(String(16), default="kelly")  # flat|percentage|kelly
    params: Mapped[dict] = mapped_column(JSON, default=dict)
    max_stake_pct: Mapped[float] = mapped_column(Float, default=5.0)
    daily_loss_stop: Mapped[float | None] = mapped_column(Float, nullable=True)
    auto_suggest_from_confidence: Mapped[bool] = mapped_column(Boolean, default=True)


class Slip(TimestampMixin, Base):
    __tablename__ = "slips"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))

    combined_odd: Mapped[float | None] = mapped_column(Float, nullable=True)
    correlation_check: Mapped[dict] = mapped_column(JSON, default=dict)  # §8B correlation-check result

    legs: Mapped[list["SlipLeg"]] = relationship(back_populates="slip")


class SlipLeg(Base):
    __tablename__ = "slip_legs"

    id: Mapped[int] = mapped_column(primary_key=True)
    slip_id: Mapped[int] = mapped_column(ForeignKey("slips.id"))
    match_id: Mapped[int] = mapped_column(ForeignKey("matches.id"))
    bet_id: Mapped[int | None] = mapped_column(ForeignKey("bets.id"), nullable=True)

    slip: Mapped[Slip] = relationship(back_populates="legs")


class CalibrationLog(Base):
    """Replaces the fixed 0.87 discount with a tracked, per-market curve
    (docs/MASTER_PLAN.md section 5.2 upgrade 4)."""

    __tablename__ = "calibration_log"

    id: Mapped[int] = mapped_column(primary_key=True)
    log_date: Mapped[date]
    market_type: Mapped[str] = mapped_column(String(32))  # "1x2" | "btts" | "over_under" | "handicap"

    picks_settled: Mapped[int] = mapped_column(Integer, default=0)
    avg_predicted_prob: Mapped[float | None] = mapped_column(Float, nullable=True)
    actual_win_rate: Mapped[float | None] = mapped_column(Float, nullable=True)
    brier_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    clv: Mapped[float | None] = mapped_column(Float, nullable=True)
    discount_factor: Mapped[float] = mapped_column(Float, default=0.87)


class DailyExposure(Base):
    """Hard daily-exposure cap tracking, §8B of the script."""

    __tablename__ = "daily_exposure"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    exposure_date: Mapped[date]
    total_pct_staked: Mapped[float] = mapped_column(Float, default=0.0)
