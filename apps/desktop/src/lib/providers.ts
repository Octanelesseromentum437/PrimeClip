import { fetchProviders } from "./api";
import { listConfiguredProviders } from "./credentials";
import type { ProviderDescriptor, ProviderKind } from "./types";

export const FALLBACK_PROVIDERS: ProviderDescriptor[] = [
  {
    kind: "ollama",
    display_name: "Ollama (Local)",
    requires_api_key: false,
    default_model: "qwen3",
    models: [],
    configured: false,
  },
  {
    kind: "claude",
    display_name: "Claude (Anthropic)",
    requires_api_key: true,
    default_model: "claude-sonnet-4-20250514",
    models: [],
    configured: false,
  },
  {
    kind: "openai",
    display_name: "OpenAI",
    requires_api_key: true,
    default_model: "gpt-4o",
    models: [],
    configured: false,
  },
  {
    kind: "openrouter",
    display_name: "OpenRouter",
    requires_api_key: true,
    default_model: "openai/gpt-4o",
    models: [],
    configured: false,
  },
  {
    kind: "custom",
    display_name: "Custom (OpenAI-compatible)",
    requires_api_key: true,
    default_model: "",
    models: [],
    configured: false,
  },
];

export function resolveModelForProvider(
  provider: ProviderDescriptor | undefined,
  currentModel: string,
): string {
  if (!provider) return currentModel;
  if (provider.models.length) {
    if (provider.models.includes(currentModel)) return currentModel;
    if (provider.default_model && provider.models.includes(provider.default_model)) {
      return provider.default_model;
    }
    return provider.models[0];
  }
  return provider.default_model || currentModel;
}

export async function loadProviders(): Promise<{
  providers: ProviderDescriptor[];
  error: string | null;
}> {
  let configured: ProviderKind[] = [];
  try {
    configured = await listConfiguredProviders();
  } catch {
    // Browser-only dev without Tauri — cloud keys come from .env on the backend.
  }

  try {
    const providers = await fetchProviders(configured);
    if (providers.length === 0) {
      return { providers: FALLBACK_PROVIDERS, error: "API returned no providers." };
    }
    return { providers, error: null };
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "Could not reach the PrimeClip API. Run `make dev-api` in another terminal.";
    return { providers: FALLBACK_PROVIDERS, error: message };
  }
}
