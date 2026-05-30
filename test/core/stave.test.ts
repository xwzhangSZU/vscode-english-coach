import { describe, it, expect } from "vitest";
import { toStave } from "../../src/core/stave";
import { ProsodyAnalysis } from "../../src/core/types";

const a: ProsodyAnalysis = {
  text: "Finish it.", isGeneratedExample: false, ipa: "/ˈfɪnɪʃ ɪt/",
  thoughtGroups: [{ tone: "fall", words: [
    { text: "Finish", syllables: ["Fin", "ish"], stressIndex: 0, stressed: true, nuclear: true, linkToNext: "liaison" },
    { text: "it", syllables: ["it"], stressIndex: null, stressed: false, nuclear: false },
  ] }],
};

describe("toStave", () => {
  it("emits one row per thought group with marks and a tone", () => {
    const rows = toStave(a);
    expect(rows).toHaveLength(1);
    expect(rows[0].tone).toBe("fall");
    expect(rows[0].toneMark).toBe("↘");
    expect(rows[0].toneLabel).toBe("fall");
    expect(rows[0].tokens[0]).toMatchObject({
      text: "Finish",
      syllables: ["Fin", "ish"],
      stressIndex: 0,
      stressed: true,
      nuclear: true,
      link: "liaison",
    });
    expect(rows[0].tokens[1]).toMatchObject({ text: "it", syllables: ["it"], stressIndex: null, stressed: false });
    expect(rows[0].points).toHaveLength(2);
    expect(rows[0].points[0]).toMatchObject({ kind: "nuclear" });
    expect(rows[0].points[0].y).toBeLessThan(rows[0].points[1].y);
  });
});
