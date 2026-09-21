"""Verified against the real Gemini API in this repo's dev pass (with a
throwaway key): `client.aio.models.list(...)` round-tripped and returned
a clean `ClientError` (400 API_KEY_INVALID), proving connectivity and
request shape.

Gemini uses "model" where the rest of this app uses "assistant", and
takes a system prompt as separate config rather than a message — both
handled here so callers never need to know that."""

from collections.abc import AsyncIterator

from google import genai
from google.genai.errors import APIError

from app.llm.base import LLMAdapter, clean_error


class GoogleAdapter(LLMAdapter):
    async def stream_chat(self, api_key: str | None, model: str, messages: list[dict[str, str]]) -> AsyncIterator[str]:
        client = genai.Client(api_key=api_key)
        contents = []
        system_instruction: str | None = None
        for m in messages:
            if m["role"] == "system":
                system_instruction = m["content"]
                continue
            role = "model" if m["role"] == "assistant" else "user"
            contents.append({"role": role, "parts": [{"text": m["content"]}]})

        config = {"system_instruction": system_instruction} if system_instruction else None
        async for chunk in client.aio.models.generate_content_stream(model=model, contents=contents, config=config):
            if chunk.text:
                yield chunk.text

    async def test_connection(self, api_key: str | None) -> tuple[bool, str]:
        client = genai.Client(api_key=api_key)
        try:
            pager = await client.aio.models.list(config={"page_size": 1})
            async for _ in pager:
                break
            return True, "Connected — key accepted."
        except APIError as e:
            return False, clean_error(e.message or str(e))
        except Exception as e:
            return False, clean_error(e)
