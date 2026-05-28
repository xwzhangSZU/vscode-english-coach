import { describe, it, expect } from "vitest";
import { buildRewriteCoachPrompt } from "../../src/core/prompt";

describe("buildRewriteCoachPrompt", () => {
  it("includes the selected text and asks for JSON output", () => {
    const { system, user } = buildRewriteCoachPrompt("I has a apple", "casual");
    expect(user).toContain("I has a apple");
    expect(system).toContain("rewritten");
    expect(system).toContain("why");
  });
});
