import { describe, it, expect } from "vitest";
import { parseContract } from "@/lib/evals/contract";

describe("parseContract", () => {
  it("extracts checklist assertions from the contract section", () => {
    const body = [
      "Do the task.",
      "",
      "## Acceptance contract",
      "- [ ] First assertion holds",
      "- [x] Second assertion holds",
      "",
      "## Notes",
      "- [ ] not an assertion (different section)",
    ].join("\n");
    const a = parseContract(body);
    expect(a.map((x) => x.text)).toEqual(["First assertion holds", "Second assertion holds"]);
    expect(a.every((x) => x.pass === undefined)).toBe(true);
  });

  it("returns [] when there is no contract section", () => {
    expect(parseContract("Just a task with an ad-hoc Acceptance: done line")).toEqual([]);
    expect(parseContract("")).toEqual([]);
  });

  it("returns [] for a contract section with no checklist items", () => {
    expect(parseContract("## Acceptance contract\n\nTBD, fill in later.")).toEqual([]);
  });

  it("ignores non-checklist lines and matches the heading case-insensitively", () => {
    const body = [
      "## acceptance CONTRACT",
      "Some prose.",
      "- [ ] Real assertion",
      "* not a dash-bracket item",
      "1. numbered, not a checkbox",
    ].join("\n");
    expect(parseContract(body).map((x) => x.text)).toEqual(["Real assertion"]);
  });
});
