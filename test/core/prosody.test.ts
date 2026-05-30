import { describe, it, expect, vi } from "vitest";
import { parseProsody, analyzeProsody, PROSODY_SCHEMA } from "../../src/core/prosody";
import * as providers from "../../src/core/providers";

const sample = JSON.stringify({
  text: "Go.", isGeneratedExample: false, ipa: "/ɡoʊ/",
  thoughtGroups: [{ tone: "fall", words: [{ text: "Go", syllables: ["Go"], stressIndex: 0, stressed: true, nuclear: true }] }],
});

describe("parseProsody", () => {
  it("parses a clean JSON object", () => {
    expect(parseProsody(sample).text).toBe("Go.");
  });
  it("strips markdown fences", () => {
    expect(parseProsody("```json\n" + sample + "\n```").text).toBe("Go.");
  });
});

describe("analyzeProsody", () => {
  it("calls the provider with the schema and returns a validated analysis", async () => {
    const spy = vi.spyOn(providers, "generateWithProvider").mockResolvedValue(sample);
    const cfg = { id: "qwen", title: "Qwen", model: "qwen3.5-flash", apiKey: "k", baseURL: "b", apiProtocol: "openai" } as any;
    const result = await analyzeProsody("Go.", cfg, 1000, 2048);
    expect(result.text).toBe("Go.");
    expect(spy).toHaveBeenCalledWith(cfg, expect.anything(), 1000, 2048, expect.objectContaining({ responseJsonSchema: PROSODY_SCHEMA }));
    spy.mockRestore();
  });
});
