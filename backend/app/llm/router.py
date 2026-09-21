"""Model router — docs/MASTER_PLAN.md §4: task_type -> an ordered model
chain, tried in order until one provider answers.

A chain entry is "provider:model_id" (e.g. "anthropic:claude-opus-5"), so
dispatch never has to guess a provider from a model id string. Defaults
below only use Anthropic model ids, since those are the only ones this
build could confirm with certainty (see docs/MASTER_PLAN.md and the
adapters' docstrings) — add other providers' chains from Settings once
you've checked their current model catalog."""

from collections.abc import AsyncIterator
from typing import TypedDict

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import decrypt_secret
from app.db.models.llm import LLMProvider, ModelRoutingRule
from app.llm.registry import ADAPTERS, KEYLESS_PROVIDERS

DEFAULT_CHAINS: dict[str, list[str]] = {
    "chat": ["anthropic:claude-haiku-4-5-20251001", "anthropic:claude-sonnet-5"],
    "football_reasoning": ["anthropic:claude-opus-5", "anthropic:claude-sonnet-5"],
    "vision": ["anthropic:claude-opus-5"],
}


class StreamEvent(TypedDict, total=False):
    type: str  # "token" | "done" | "error"
    text: str
    provider: str
    model: str
    full_text: str
    message: str


def get_model_chain(db: Session, user_id: int, task_type: str) -> list[tuple[str, str]]:
    rule = db.scalar(
        select(ModelRoutingRule).where(ModelRoutingRule.user_id == user_id, ModelRoutingRule.task_type == task_type)
    )
    raw_chain = rule.model_chain if rule and rule.model_chain else DEFAULT_CHAINS.get(task_type, DEFAULT_CHAINS["chat"])

    parsed = []
    for entry in raw_chain:
        provider, _, model = entry.partition(":")
        if provider and model:
            parsed.append((provider, model))
    return parsed


async def stream_with_fallback(
    db: Session, user_id: int, task_type: str, messages: list[dict[str, str]]
) -> AsyncIterator[StreamEvent]:
    chain = get_model_chain(db, user_id, task_type)
    providers_by_name = {p.name: p for p in db.scalars(select(LLMProvider).where(LLMProvider.user_id == user_id))}

    last_error: str | None = None
    tried = False

    for provider_name, model in chain:
        adapter = ADAPTERS.get(provider_name)
        if adapter is None:
            continue

        provider_row = providers_by_name.get(provider_name)
        api_key = None
        if provider_name not in KEYLESS_PROVIDERS:
            if provider_row is None or not provider_row.api_key_encrypted:
                continue  # not configured — skip straight to the next model in the chain
            api_key = decrypt_secret(provider_row.api_key_encrypted)

        tried = True
        try:
            full_text = ""
            async for delta in adapter.stream_chat(api_key, model, messages):
                full_text += delta
                yield {"type": "token", "text": delta, "provider": provider_name, "model": model}
            yield {"type": "done", "provider": provider_name, "model": model, "full_text": full_text}
            return
        except Exception as e:
            last_error = f"{provider_name} ({model}): {e}"
            continue

    if not tried:
        yield {"type": "error", "message": "No provider is configured for this yet — add a key in Settings."}
    else:
        yield {"type": "error", "message": last_error or "Every provider in the chain failed."}
