import { describe, it, expect } from "vitest";
import { isEligible, filterEligible } from "@/lib/eligibleAgents";

describe("eligibleAgents", () => {
  it("matches when any skill is in capabilities", () => {
    expect(isEligible(["research", "writing"], ["research"])).toBe(true);
    expect(isEligible(["research"], ["physics", "research"])).toBe(true);
  });
  it("returns false when no skill overlaps", () => {
    expect(isEligible(["research"], ["coding"])).toBe(false);
  });
  it("returns true when capabilities is empty (no filter)", () => {
    expect(isEligible([], ["research"])).toBe(true);
  });
  it("returns false when agent has no skills", () => {
    expect(isEligible(["research"], [])).toBe(false);
  });

  it("filterEligible keeps matching agents", () => {
    const agents = [
      { slug: "a", skills: ["research"] },
      { slug: "b", skills: ["coding"] },
      { slug: "c", skills: ["writing", "research"] },
    ];
    const result = filterEligible(agents, ["research"]);
    expect(result.map(a => a.slug)).toEqual(["a", "c"]);
  });
});
