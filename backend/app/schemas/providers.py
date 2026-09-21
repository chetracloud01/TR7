from pydantic import BaseModel, Field


class ProviderUpsert(BaseModel):
    name: str = Field(..., description='e.g. "anthropic", "openai", "google", "xai", "deepseek", "ollama"')
    api_key: str | None = None  # omit/None for a key-less provider like a local Ollama
    capabilities: list[str] = Field(default_factory=list)
    enabled: bool = True


class ProviderOut(BaseModel):
    id: int
    name: str
    enabled: bool
    capabilities: list[str]
    connected: bool
    masked_key: str | None

    model_config = {"from_attributes": True}


class ProviderTestResult(BaseModel):
    ok: bool
    message: str
