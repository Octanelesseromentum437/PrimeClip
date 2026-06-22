import { describe, expect, it } from "vitest";
import { resolveModelForProvider } from "./providers";
import type { ProviderDescriptor } from "./types";

const baseProvider: ProviderDescriptor = {
  kind: "openai",
  display_name: "OpenAI",
  requires_api_key: true,
  default_model: "gpt-4o",
  models: ["gpt-4o", "gpt-4o-mini"],
  configured: true,
};

describe("resolveModelForProvider", () => {
  it("keeps current model when it is listed", () => {
    expect(resolveModelForProvider(baseProvider, "gpt-4o-mini")).toBe("gpt-4o-mini");
  });

  it("falls back to default model when current is not listed", () => {
    expect(resolveModelForProvider(baseProvider, "unknown-model")).toBe("gpt-4o");
  });

  it("uses first listed model when default is missing from list", () => {
    const provider: ProviderDescriptor = {
      ...baseProvider,
      default_model: "missing",
      models: ["alpha", "beta"],
    };
    expect(resolveModelForProvider(provider, "gamma")).toBe("alpha");
  });

  it("uses default model when provider has no model list", () => {
    const provider: ProviderDescriptor = { ...baseProvider, models: [] };
    expect(resolveModelForProvider(provider, "custom")).toBe("gpt-4o");
  });

  it("returns current model when provider is undefined", () => {
    expect(resolveModelForProvider(undefined, "keep-me")).toBe("keep-me");
  });
});
