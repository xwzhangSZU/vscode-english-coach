import { describe, expect, it } from "vitest";
import { alignTimings, flattenStaveTokenTexts, proportionalTimings } from "../../src/core/align";

describe("alignTimings", () => {
  it("matches tokens to ASR words by normalized text, in order", () => {
    const tokens = ["I", "really", "want", "it"];
    const asr = [
      { word: "I", start: 0, end: 0.1 },
      { word: "really", start: 0.1, end: 0.5 },
      { word: "want", start: 0.5, end: 0.8 },
      { word: "it.", start: 0.8, end: 1.0 },
    ];
    expect(alignTimings(tokens, asr, 1)).toEqual([
      { start: 0, end: 0.1 },
      { start: 0.1, end: 0.5 },
      { start: 0.5, end: 0.8 },
      { start: 0.8, end: 1 },
    ]);
  });

  it("falls back to proportional timing when ASR is empty", () => {
    expect(alignTimings(["a", "b"], [], 2)).toEqual([
      { start: 0, end: 1 },
      { start: 1, end: 2 },
    ]);
  });

  it("uses a usable proportional fallback when duration is unknown", () => {
    expect(proportionalTimings(2, 0)).toEqual([
      { start: 0, end: 1 },
      { start: 1, end: 2 },
    ]);
  });

  it("flattens stave token text in running render order", () => {
    expect(
      flattenStaveTokenTexts([
        { tone: "level", toneMark: "→", toneLabel: "level", points: [], tokens: [{ text: "Could", stressed: false, nuclear: false, reduced: true }] },
        { tone: "rise", toneMark: "↗", toneLabel: "rise", points: [], tokens: [{ text: "again", stressed: true, nuclear: true, reduced: false }] },
      ]),
    ).toEqual(["Could", "again"]);
  });
});
