import { describe, expect, it } from "vitest";
import { buildFeedbackTip, compareWords } from "../../src/core/feedback";

describe("compareWords", () => {
  it("reports matched count, missed, and extra words case/punctuation-insensitively", () => {
    const result = compareWords("I really want it.", "I want it");
    expect(result.matched).toBe(3);
    expect(result.total).toBe(4);
    expect(result.missed).toEqual(["really"]);
    expect(result.extra).toEqual([]);
  });

  it("flags extra words the learner added", () => {
    const result = compareWords("Go now", "Go go now please");
    expect(result.extra).toEqual(["go", "please"]);
    expect(result.missed).toEqual([]);
  });

  it("coverage is matched over total", () => {
    expect(compareWords("a b c d", "a b").coverage).toBeCloseTo(0.5);
  });

  it("builds a coaching tip from the diff", () => {
    expect(buildFeedbackTip(compareWords("I really want it", "I want it"))).toContain("really");
  });
});
