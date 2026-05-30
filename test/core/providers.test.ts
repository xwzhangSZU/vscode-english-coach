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
    expect(detectProtocol("minimax", "https://api.minimaxi.com/anthropic")).toBe("anthropic");
  });
  it("mimo /v1 token-plan endpoint -> openai", () => {
    expect(detectProtocol("mimo", "https://token-plan-cn.xiaomimimo.com/v1")).toBe("openai");
  });
  it("qwen is always openai (DashScope compatible-mode)", () => {
    expect(detectProtocol("qwen", "https://dashscope.aliyuncs.com/compatible-mode/v1")).toBe("openai");
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

  it("uses MiMo Token Plan headers, disables thinking, and falls back to JSON object mode", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: "{}" } }] }), { status: 200 }),
    );
    const config: ProviderConfig = {
      id: "mimo",
      title: "Xiaomi MiMo",
      apiKey: "tp-test",
      baseURL: "https://token-plan-cn.xiaomimimo.com/v1",
      model: "mimo-v2.5-pro",
      apiProtocol: "openai",
    };
    await generateWithProvider(config, { system: "s", user: "u" }, 5000, 256, {
      responseMimeType: "application/json",
      responseJsonSchema: { type: "object", properties: { ok: { type: "boolean" } } },
    });
    const [, init] = fetchMock.mock.calls[0];
    const headers = init?.headers as Record<string, string>;
    const body = JSON.parse(String(init?.body));
    expect(headers.Authorization).toBe("Bearer tp-test");
    expect(headers["api-key"]).toBe("tp-test");
    expect(body.thinking).toEqual({ type: "disabled" });
    expect(body.response_format).toEqual({ type: "json_object" });
    expect(body.messages[0].content).toContain("JSON schema");
  });
});

describe("generateWithProvider (Gemini protocol)", () => {
  it("uses Gemini JSON mime mode and embeds schema constraints in the prompt", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "{}" }] } }] }), { status: 200 }),
    );
    const config: ProviderConfig = {
      id: "gemini",
      title: "Gemini",
      apiKey: "gem-test",
      baseURL: "https://generativelanguage.googleapis.com/v1beta",
      model: "gemini-3.5-flash",
      apiProtocol: "openai",
    };
    await generateWithProvider(config, { system: "s", user: "u" }, 5000, 256, {
      responseMimeType: "application/json",
      responseJsonSchema: { type: "object", properties: { ok: { type: "boolean" } } },
    });
    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(String(init?.body));
    expect(body.generationConfig.responseMimeType).toBe("application/json");
    expect(body.generationConfig.responseFormat).toBeUndefined();
    expect(body.system_instruction.parts[0].text).toContain("Structured output requirements");
    expect(body.system_instruction.parts[0].text).toContain("JSON schema");
  });
});
