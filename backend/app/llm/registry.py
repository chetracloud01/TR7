from app.llm.adapters.anthropic_adapter import AnthropicAdapter
from app.llm.adapters.google_adapter import GoogleAdapter
from app.llm.adapters.openai_compat_adapter import OpenAICompatAdapter
from app.llm.base import LLMAdapter

# Verified live against Anthropic and Google in this repo's dev pass (see
# each adapter's docstring). OpenAI/xAI/DeepSeek use the same well-defined
# OpenAI-compatible shape but weren't reachable to test live here.
ADAPTERS: dict[str, LLMAdapter] = {
    "anthropic": AnthropicAdapter(),
    "google": GoogleAdapter(),
    "openai": OpenAICompatAdapter(base_url=None),
    "xai": OpenAICompatAdapter(base_url="https://api.x.ai/v1"),
    "deepseek": OpenAICompatAdapter(base_url="https://api.deepseek.com"),
    "ollama": OpenAICompatAdapter(base_url="http://localhost:11434/v1"),
}

KEYLESS_PROVIDERS = {"ollama"}
