"""The LLM Gateway's provider abstraction — docs/MASTER_PLAN.md §4.

One call shape (`stream_chat`) across every provider, so the router and
the chat route never need to know which SDK they're talking to."""

from abc import ABC, abstractmethod
from collections.abc import AsyncIterator


class LLMAdapter(ABC):
    @abstractmethod
    def stream_chat(self, api_key: str | None, model: str, messages: list[dict[str, str]]) -> AsyncIterator[str]:
        """Yields text deltas as they arrive. messages is a list of
        {"role": "user"|"assistant"|"system", "content": str}."""
        raise NotImplementedError

    @abstractmethod
    async def test_connection(self, api_key: str | None) -> tuple[bool, str]:
        """A cheap, real call (never a token-spending completion) that
        proves the key is accepted — used by Settings' "Test" button."""
        raise NotImplementedError


def clean_error(e: Exception) -> str:
    """Provider SDK exceptions are already good single-line messages
    (see the adapters' docstrings for what was verified live) — this just
    keeps a stray huge payload from blowing up the UI."""
    msg = str(e).strip()
    return msg[:300] if len(msg) > 300 else msg
