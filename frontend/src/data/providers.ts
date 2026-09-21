import { ProviderCatalogEntry } from "@/components/ProviderCard";

export const PROVIDER_CATALOG: ProviderCatalogEntry[] = [
  { name: "anthropic", label: "Anthropic", modelsHint: "Claude Opus 5 · Sonnet 5 · Haiku 4.5", capabilities: ["chat", "vision", "reasoning"] },
  { name: "openai", label: "OpenAI", modelsHint: "GPT-5 · GPT-5 mini", capabilities: ["chat", "vision"] },
  { name: "google", label: "Google Gemini", modelsHint: "Gemini · strong on vision/document parsing", capabilities: ["chat", "vision"] },
  { name: "xai", label: "xAI Grok", modelsHint: "Grok", capabilities: ["chat"] },
  { name: "deepseek", label: "DeepSeek", modelsHint: "DeepSeek chat/reasoner", capabilities: ["chat", "reasoning"] },
];

// +1 for Ollama, which is keyless and always "connected" — see ProviderCard/Settings.
export const TOTAL_PROVIDER_COUNT = PROVIDER_CATALOG.length + 1;
