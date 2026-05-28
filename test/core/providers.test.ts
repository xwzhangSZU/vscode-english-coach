import { describe, it, expect, vi, afterEach } from "vitest";
import { detectProtocol, generateWithProvider } from "../../src/core/providers";
import type { ProviderConfig } from "../../src/core/types";

afterEach(() => vi.restoreAllMocks());

describe("detectProtocol", () => {
  it("gemini and openai are always openai", () => {
    expect(detectProtocol("gemini", "https://x")).toBe("openai");
    expect(detectProtocol("openai", "https://x")).toBe("openai");
  });
  it("anthropic-shaped paths -> anthropic", () => {
    expect(detectProtocol("deepseek", "https://api.deepseek.com/anthropic")).toBe("anthropic");
    expect(detectProtocol("kimi", "https://api.kimi.com/coding")).toBe("anthropic");
  });
  it("moonshot host and /v1 endpoints -> openai", () => {
    expect(detectProtocol("kimi", "https://api.moonshot.ai/v1")).toBe("openai");
  });
  it("falls back to anthropic", () => {
    expect(detectProtocol("mimo", "https://example.com/foo")).toBe("anthropic");
  });
});

describe("generateWithProvider (OpenAI protocol)", () => {
  it("posts to /chat/completions and returns content", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: "hello" } }] }), { status: 200 }),
    );
    const config: ProviderConfig = {
      id: "openai",
      title: "OpenAI",
      apiKey: "sk-test",
      baseURL: "https://api.openai.com/v1",
      model: "gpt-4.1-mini",
      apiProtocol: "openai",
    };
    const out = await generateWithProvider(config, { system: "s", user: "u" }, 5000, 256);
    expect(out).toBe("hello");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.openai.com/v1/chat/completions",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
