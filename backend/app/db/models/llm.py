from sqlalchemy import JSON, Boolean, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base, TimestampMixin


class LLMProvider(Base):
    """A configured provider + its encrypted key. See docs/MASTER_PLAN.md
    section 4 (LLM Gateway design)."""

    __tablename__ = "llm_providers"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))

    name: Mapped[str] = mapped_column(String(64))  # "anthropic" | "openai" | "google" | "xai" | "deepseek" | "ollama"
    api_key_encrypted: Mapped[str | None] = mapped_column(Text, nullable=True)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    capabilities: Mapped[list[str]] = mapped_column(JSON, default=list)  # e.g. ["chat","vision","reasoning"]


class ModelRoutingRule(Base):
    """task_type -> ordered model preference chain, editable from Settings
    without a code change (docs/MASTER_PLAN.md section 4)."""

    __tablename__ = "model_routing_rules"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))

    task_type: Mapped[str] = mapped_column(String(64))  # "vision" | "football_reasoning" | "chat" | ...
    model_chain: Mapped[list[str]] = mapped_column(JSON, default=list)  # ordered fallback chain


class ChatSession(TimestampMixin, Base):
    __tablename__ = "chat_sessions"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    title: Mapped[str] = mapped_column(String(255))

    messages: Mapped[list["ChatMessage"]] = relationship(back_populates="session", order_by="ChatMessage.id")


class ChatMessage(TimestampMixin, Base):
    __tablename__ = "chat_messages"

    id: Mapped[int] = mapped_column(primary_key=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("chat_sessions.id"))
    role: Mapped[str] = mapped_column(String(16))  # "user" | "assistant" | "system"
    content: Mapped[str] = mapped_column(Text)
    model_used: Mapped[str | None] = mapped_column(String(64), nullable=True)

    session: Mapped[ChatSession] = relationship(back_populates="messages")


class LLMUsageLog(TimestampMixin, Base):
    """Every gateway call logged for cost/latency visibility
    (docs/MASTER_PLAN.md section 4)."""

    __tablename__ = "llm_usage_log"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))

    provider: Mapped[str] = mapped_column(String(64))
    model: Mapped[str] = mapped_column(String(128))
    task_type: Mapped[str | None] = mapped_column(String(64), nullable=True)
    tokens_in: Mapped[int] = mapped_column(Integer, default=0)
    tokens_out: Mapped[int] = mapped_column(Integer, default=0)
    cost_estimate_usd: Mapped[float] = mapped_column(Float, default=0.0)
    latency_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
