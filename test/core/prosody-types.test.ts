import { describe, it, expect } from "vitest";
import { validateProsody } from "../../src/core/types";

const good = {
  text: "Finish it.", isGeneratedExample: false, ipa: "/ˈfɪnɪʃ ɪt/",
  thoughtGroups: [
    { tone: "fall", words: [
      { text: "Finish", syllables: ["Fin", "ish"], stressIndex: 0, stressed: true, nuclear: true },
      { text: "it", syllables: ["it"], stressIndex: null, stressed: false, nuclear: false },
    ] },
  ],
};

describe("validateProsody", () => {
  it("accepts a well-formed analysis", () => {
    expect(validateProsody(good).text).toBe("Finish it.");
  });
  it("rejects a nuclear word that is not stressed", () => {
    const bad = structuredClone(good);
    bad.thoughtGroups[0].words[0].stressed = false;
    expect(() => validateProsody(bad)).toThrow(/nuclear/i);
  });
  it("rejects an out-of-range stressIndex", () => {
    const bad = structuredClone(good);
    bad.thoughtGroups[0].words[0].stressIndex = 5;
    expect(() => validateProsody(bad)).toThrow(/stressIndex/i);
  });
  it("rejects an unknown tone", () => {
    const bad = structuredClone(good);
    (bad.thoughtGroups[0] as any).tone = "wobble";
    expect(() => validateProsody(bad)).toThrow(/tone/i);
  });
});
