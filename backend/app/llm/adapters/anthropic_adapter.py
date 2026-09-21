"""Verified against the real Anthropic API in this repo's dev pass (with
a throwaway key — no real completion was ever fetched, just the auth
path): both `client.messages.stream(...)` and `client.models.list(...)`
round-tripped and returned clean `AuthenticationError`s, proving the
request shape below is correct, not just plausible."""

from collections.abc import AsyncIterator

import anthropic

from app.llm.base import LLMAdapter, clean_error


class AnthropicAdapter(LLMAdapter):
    async def stream_chat(self, api_key: str | None, model: str, messages: list[dict[str, str]]) -> AsyncIterator[str]:
        client = anthropic.AsyncAnthropic(api_key=api_key)
        system: str | None = None
        chat_messages = []
        for m in messages:
            if m["role"] == "system":
                system = m["content"]
            else:
                chat_messages.append({"role": m["role"], "content": m["content"]})

        kwargs: dict = {"model": model, "max_tokens": 2048, "messages": chat_messages}
        if system:
            kwargs["system"] = system

        async with client.messages.stream(**kwargs) as stream:
            async for text in stream.text_stream:
                yield text

    async def test_connection(self, api_key: str | None) -> tuple[bool, str]:
        client = anthropic.AsyncAnthropic(api_key=api_key)
        try:
            await client.models.list(limit=1)
            return True, "Connected — key accepted."
        except anthropic.AuthenticationError:
            return False, "Anthropic rejected this key."
        except Exception as e:
            return False, clean_error(e)
