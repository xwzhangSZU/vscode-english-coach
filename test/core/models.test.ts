import { describe, it, expect } from "vitest";
import {
  DEFAULT_SAY_IT_RIGHT_ANALYSIS_MODELS,
  DEFAULT_TTS_VOICES,
  SAY_IT_RIGHT_ANALYSIS_MODELS,
  TTS_VOICES,
  resolveModel,
  getTierLabel,
} from "../../src/core/models";

describe("resolveModel", () => {
  it("returns the catalog id for fast/pro", () => {
    expect(resolveModel("deepseek", "fast", "")).toBe("deepseek-v4-flash");
    expect(resolveModel("deepseek", "pro", "")).toBe("deepseek-v4-pro");
  });
  it("returns the custom model for custom tier", () => {
    expect(resolveModel("openai", "custom", "my-model")).toBe("my-model");
  });
  it("resolves Qwen models", () => {
    expect(resolveModel("qwen", "fast", "")).toBe("qwen-plus");
    expect(resolveModel("qwen", "pro", "")).toBe("qwen-max");
  });
  it("resolves the MiniMax high-speed model", () => {
    expect(resolveModel("minimax", "fast", "")).toBe("MiniMax-M2.7-highspeed");
    expect(resolveModel("minimax", "pro", "")).toBe("MiniMax-M2.7-highspeed");
  });
  it("keeps expired MiMo routing ids out of the active catalogs", () => {
    expect(SAY_IT_RIGHT_ANALYSIS_MODELS.mimo.map((m) => m.id)).not.toContain("mimo-v2-pro");
    expect(SAY_IT_RIGHT_ANALYSIS_MODELS.mimo.map((m) => m.id)).not.toContain("mimo-v2-omni");
  });
  it("uses current pronunciation defaults", () => {
    expect(DEFAULT_SAY_IT_RIGHT_ANALYSIS_MODELS.qwen).toBe("qwen3.6-flash");
    expect(DEFAULT_TTS_VOICES.minimax).toBe("English_expressive_narrator");
    expect(TTS_VOICES.minimax).not.toContain("male-qn-qingse");
  });
});

describe("getTierLabel", () => {
  it("labels known tiers", () => {
    expect(getTierLabel("fast")).toBe("Fast");
    expect(getTierLabel("pro")).toBe("Pro");
  });
});
