"""One adapter class for every OpenAI-compatible endpoint — OpenAI itself,
xAI, DeepSeek, and a local Ollama, each just a different base_url. The
`chat.completions.create(stream=True)` / `models.list()` shapes here are
confirmed present on the installed `openai` SDK (v3) by introspection,
but — unlike the Anthropic/Google adapters — this repo's sandbox network
policy blocks api.openai.com/api.x.ai/api.deepseek.com outright, so
these specific calls were never exercised against a live endpoint here.
Worth a real test against whichever of these you actually use."""

from collections.abc import AsyncIterator

import openai

from app.llm.base import LLMAdapter, clean_error


class OpenAICompatAdapter(LLMAdapter):
    def __init__(self, base_url: str | None = None):
        self.base_url = base_url

    def _client(self, api_key: str | None) -> openai.AsyncOpenAI:
        # A local Ollama doesn't check the key, but the SDK requires a
        # non-empty string to construct the client.
        return openai.AsyncOpenAI(api_key=api_key or "not-needed", base_url=self.base_url)

    async def stream_chat(self, api_key: str | None, model: str, messages: list[dict[str, str]]) -> AsyncIterator[str]:
        client = self._client(api_key)
        stream = await client.chat.completions.create(model=model, messages=messages, stream=True)
        async for chunk in stream:
            if not chunk.choices:
                continue
            delta = chunk.choices[0].delta.content
            if delta:
                yield delta

    async def test_connection(self, api_key: str | None) -> tuple[bool, str]:
        client = self._client(api_key)
        try:
            await client.models.list()
            return True, "Connected — key accepted."
        except openai.AuthenticationError:
            return False, "This provider rejected the key."
        except openai.APIConnectionError:
            return False, "Couldn't reach the server — check it's running/reachable." if self.base_url else "Couldn't reach OpenAI."
        except Exception as e:
            return False, clean_error(e)
