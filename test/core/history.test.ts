import { describe, it, expect } from "vitest";
import { mergeHistory, isHistoryEntry, HistoryEntry } from "../../src/core/history";

function entry(p: Partial<HistoryEntry>): HistoryEntry {
  return { id: "x", kind: "coach", source: "s", output: "o", provider: "DeepSeek", model: "m", createdAt: 1, ...p };
}

describe("mergeHistory", () => {
  it("prepends the new entry", () => {
    const out = mergeHistory([entry({ id: "a" })], entry({ id: "b", source: "s2" }));
    expect(out.map((e) => e.id)).toEqual(["b", "a"]);
  });
  it("drops an exact duplicate (same kind+source+output)", () => {
    const out = mergeHistory([entry({ id: "a", source: "hi", output: "Hi." })], entry({ id: "b", source: "hi", output: "Hi." }));
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe("b");
  });
  it("keeps entries that differ in kind", () => {
    const out = mergeHistory([entry({ id: "a", kind: "coach" })], entry({ id: "b", kind: "translate" }));
    expect(out).toHaveLength(2);
  });
  it("caps the list at max", () => {
    const existing = Array.from({ length: 3 }, (_, i) => entry({ id: `e${i}`, source: `s${i}` }));
    const out = mergeHistory(existing, entry({ id: "new", source: "new" }), 3);
    expect(out).toHaveLength(3);
    expect(out[0].id).toBe("new");
    expect(out.map((e) => e.id)).not.toContain("e2");
  });
  it("keeps starred entries beyond the cap (the review deck never ages out)", () => {
    const existing = [
      entry({ id: "star", source: "kept", starred: true }),
      ...Array.from({ length: 3 }, (_, i) => entry({ id: `e${i}`, source: `s${i}` })),
    ];
    const out = mergeHistory(existing, entry({ id: "new", source: "new" }), 2);
    expect(out.map((e) => e.id)).toContain("star"); // survives despite cap=2
    expect(out.filter((e) => !e.starred)).toHaveLength(2); // only unstarred is capped
  });
  it("re-coaching a starred pair keeps the star", () => {
    const existing = [entry({ id: "old", source: "hi", output: "Hi.", starred: true })];
    const out = mergeHistory(existing, entry({ id: "new", source: "hi", output: "Hi." }));
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe("new");
    expect(out[0].starred).toBe(true);
  });
});

describe("isHistoryEntry", () => {
  it("accepts a valid entry and rejects junk", () => {
    expect(isHistoryEntry(entry({}))).toBe(true);
    expect(isHistoryEntry({ id: "x" })).toBe(false);
    expect(isHistoryEntry(null)).toBe(false);
  });
});
