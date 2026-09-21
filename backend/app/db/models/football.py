"""Football Prediction module — mirrors the Master Script v3.1 engine
documented in docs/MASTER_PLAN.md section 5."""

from datetime import datetime

from sqlalchemy import JSON, Boolean, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base, TimestampMixin


class MatchBatch(TimestampMixin, Base):
    """One uploaded sheet/screenshot/PDF parse — the unit the Full Match
    Board is built from (§5.1, §8D/§8E of the script)."""

    __tablename__ = "match_batches"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))

    source_ref: Mapped[str | None] = mapped_column(String(512), nullable=True)
    mode: Mapped[str] = mapped_column(String(16), default="full_rating")  # "full_rating" | "qualifying"

    matches: Mapped[list["Match"]] = relationship(back_populates="batch")


class Match(Base):
    __tablename__ = "matches"

    id: Mapped[int] = mapped_column(primary_key=True)
    batch_id: Mapped[int] = mapped_column(ForeignKey("match_batches.id"))

    date_kickoff_ict: Mapped[datetime]
    competition_country: Mapped[str] = mapped_column(String(128))
    competition: Mapped[str] = mapped_column(String(255))

    home_team: Mapped[str] = mapped_column(String(255))
    home_team_country: Mapped[str] = mapped_column(String(128))
    away_team: Mapped[str] = mapped_column(String(255))
    away_team_country: Mapped[str] = mapped_column(String(128))

    odds_home: Mapped[float | None] = mapped_column(Float, nullable=True)
    odds_draw: Mapped[float | None] = mapped_column(Float, nullable=True)
    odds_away: Mapped[float | None] = mapped_column(Float, nullable=True)
    odds_source: Mapped[str] = mapped_column(String(16), default="uploaded")  # "live_api" | "uploaded"
    odds_synced_at: Mapped[datetime | None] = mapped_column(nullable=True)

    batch: Mapped[MatchBatch] = relationship(back_populates="matches")
    app_prediction: Mapped["AppPrediction | None"] = relationship(back_populates="match", uselist=False)
    research_predictions: Mapped[list["ResearchPrediction"]] = relationship(back_populates="match")
    rule_flags: Mapped[list["ContextRuleFlag"]] = relationship(back_populates="match")
    prediction: Mapped["Prediction | None"] = relationship(back_populates="match", uselist=False)
    confidence_score: Mapped["ConfidenceScore | None"] = relationship(back_populates="match", uselist=False)
    risk_flag: Mapped["RiskFlag | None"] = relationship(back_populates="match", uselist=False)
    result: Mapped["MatchResult | None"] = relationship(back_populates="match", uselist=False)


class AppPrediction(Base):
    """Extracted from the uploaded screenshot/text/file — §1B of the
    script's fixed field list."""

    __tablename__ = "app_predictions"

    id: Mapped[int] = mapped_column(primary_key=True)
    match_id: Mapped[int] = mapped_column(ForeignKey("matches.id"), unique=True)

    tip: Mapped[str | None] = mapped_column(String(32), nullable=True)
    h_pct: Mapped[float | None] = mapped_column(Float, nullable=True)
    d_pct: Mapped[float | None] = mapped_column(Float, nullable=True)
    a_pct: Mapped[float | None] = mapped_column(Float, nullable=True)
    over_under: Mapped[str | None] = mapped_column(String(16), nullable=True)
    btts: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    correct_score: Mapped[str | None] = mapped_column(String(16), nullable=True)
    handicap_line: Mapped[str | None] = mapped_column(String(32), nullable=True)
    raw_input_ref: Mapped[str | None] = mapped_column(String(512), nullable=True)

    match: Mapped[Match] = relationship(back_populates="app_prediction")


class ResearchPrediction(Base):
    """Independent research pass — §3 of the script. Multiple rows per
    match once the ensemble-research upgrade (§5.2) lands: one per model."""

    __tablename__ = "research_predictions"

    id: Mapped[int] = mapped_column(primary_key=True)
    match_id: Mapped[int] = mapped_column(ForeignKey("matches.id"))

    model_used: Mapped[str] = mapped_column(String(128))
    raw_prob: Mapped[float] = mapped_column(Float)
    disc_prob: Mapped[float] = mapped_column(Float)  # raw_prob * calibration discount, §3B/R4
    correct_score: Mapped[str | None] = mapped_column(String(16), nullable=True)
    btts: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    over_under: Mapped[str | None] = mapped_column(String(16), nullable=True)
    handicap_line: Mapped[str | None] = mapped_column(String(32), nullable=True)
    rationale: Mapped[str | None] = mapped_column(Text, nullable=True)
    sources: Mapped[list[str]] = mapped_column(JSON, default=list)

    match: Mapped[Match] = relationship(back_populates="research_predictions")


class ContextRuleFlag(Base):
    """R1-R6 per match (§4 of the script)."""

    __tablename__ = "context_rule_flags"

    id: Mapped[int] = mapped_column(primary_key=True)
    match_id: Mapped[int] = mapped_column(ForeignKey("matches.id"))

    rule_code: Mapped[str] = mapped_column(String(4))  # "R1".."R6"
    fired: Mapped[bool] = mapped_column(Boolean, default=False)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)

    match: Mapped[Match] = relationship(back_populates="rule_flags")


class Prediction(Base):
    """The reconciled App-vs-research verdict for a match (§5 dual
    comparison table + qualifying filter, §6)."""

    __tablename__ = "predictions"

    id: Mapped[int] = mapped_column(primary_key=True)
    match_id: Mapped[int] = mapped_column(ForeignKey("matches.id"), unique=True)
    app_prediction_id: Mapped[int | None] = mapped_column(ForeignKey("app_predictions.id"), nullable=True)
    research_prediction_id: Mapped[int | None] = mapped_column(ForeignKey("research_predictions.id"), nullable=True)

    final_tip: Mapped[str | None] = mapped_column(String(32), nullable=True)
    final_odd: Mapped[float | None] = mapped_column(Float, nullable=True)
    final_prob: Mapped[float | None] = mapped_column(Float, nullable=True)
    ev: Mapped[float | None] = mapped_column(Float, nullable=True)
    agreement: Mapped[str] = mapped_column(String(16), default="pending")  # agree|partial|disagree|overridden

    match: Mapped[Match] = relationship(back_populates="prediction")


class ConfidenceScore(Base):
    """8-factor score -> stars (§7 of the script)."""

    __tablename__ = "confidence_scores"

    id: Mapped[int] = mapped_column(primary_key=True)
    match_id: Mapped[int] = mapped_column(ForeignKey("matches.id"), unique=True)

    factor_breakdown: Mapped[dict] = mapped_column(JSON, default=dict)  # {"ev_size": 2, "edge": 2, ...}
    total_points: Mapped[int] = mapped_column(Integer)
    stars: Mapped[int] = mapped_column(Integer)  # 1-5

    match: Mapped[Match] = relationship(back_populates="confidence_score")


class RiskFlag(Base):
    """Risk tier (independent of stars) + usage flag, §7B/§8D."""

    __tablename__ = "risk_flags"

    id: Mapped[int] = mapped_column(primary_key=True)
    match_id: Mapped[int] = mapped_column(ForeignKey("matches.id"), unique=True)

    risk_tier: Mapped[str] = mapped_column(String(8))  # low | medium | high
    usage_flag: Mapped[str | None] = mapped_column(String(24), nullable=True)
    # banker_only | lottery_odd | friendly | cs_mismatch | null

    match: Mapped[Match] = relationship(back_populates="risk_flag")


class MatchResult(Base):
    """Closes the feedback loop (docs/MASTER_PLAN.md §5.2 upgrade 7) —
    settles the linked bet and feeds the calibration log."""

    __tablename__ = "match_results"

    id: Mapped[int] = mapped_column(primary_key=True)
    match_id: Mapped[int] = mapped_column(ForeignKey("matches.id"), unique=True)

    actual_score: Mapped[str | None] = mapped_column(String(16), nullable=True)
    actual_outcome: Mapped[str | None] = mapped_column(String(4), nullable=True)  # "1" | "X" | "2"
    actual_btts: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    actual_total_goals: Mapped[int | None] = mapped_column(Integer, nullable=True)
    settled_at: Mapped[datetime | None] = mapped_column(nullable=True)
    result_source: Mapped[str] = mapped_column(String(16), default="auto_api")  # auto_api | manual

    match: Mapped[Match] = relationship(back_populates="result")
