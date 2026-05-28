import { describe, it, expect } from "vitest";
import { resolveModel, getTierLabel } from "../../src/core/models";

describe("resolveModel", () => {
  it("returns the catalog id for fast/pro", () => {
    expect(resolveModel("deepseek", "fast", "")).toBe("deepseek-v4-flash");
    expect(resolveModel("deepseek", "pro", "")).toBe("deepseek-v4-pro");
  });
  it("returns the custom model for custom tier", () => {
    expect(resolveModel("openai", "custom", "my-model")).toBe("my-model");
  });
});

describe("getTierLabel", () => {
  it("labels known tiers", () => {
    expect(getTierLabel("fast")).toBe("Fast");
    expect(getTierLabel("pro")).toBe("Pro");
  });
});
