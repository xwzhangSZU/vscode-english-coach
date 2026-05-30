import { describe, it, expect } from "vitest";
import { splitSentences } from "../../src/core/segment";

describe("splitSentences", () => {
  it("splits on sentence-ending punctuation", () => {
    expect(splitSentences("I want this. Do you?")).toEqual(["I want this.", "Do you?"]);
  });
  it("does not split on abbreviations", () => {
    expect(splitSentences("Dr. Smith arrived. He left.")).toEqual(["Dr. Smith arrived.", "He left."]);
  });
  it("does not split on decimals", () => {
    expect(splitSentences("It costs 3.5 dollars. Cheap.")).toEqual(["It costs 3.5 dollars.", "Cheap."]);
  });
  it("keeps a trailing fragment with no terminator", () => {
    expect(splitSentences("Just one line")).toEqual(["Just one line"]);
  });
  it("trims whitespace and drops empties", () => {
    expect(splitSentences("  A.   B.  ")).toEqual(["A.", "B."]);
  });
});
