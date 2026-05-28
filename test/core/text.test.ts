import { describe, it, expect } from "vitest";
import { normalizeInputText, quoted } from "../../src/core/text";

describe("normalizeInputText", () => {
  it("trims, normalizes CRLF, and caps length", () => {
    expect(normalizeInputText("  hi\r\nthere  ")).toBe("hi\nthere");
    expect(normalizeInputText(undefined)).toBe("");
    expect(normalizeInputText("a".repeat(13000)).length).toBe(12000);
  });
});

describe("quoted", () => {
  it("prefixes every line with '> '", () => {
    expect(quoted("a\nb")).toBe("> a\n> b");
  });
});
