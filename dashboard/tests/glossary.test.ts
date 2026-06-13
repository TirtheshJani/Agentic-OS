import "./helpers/repoRootStub";
import { describe, it, expect } from "vitest";
import { parseGlossary, glossaryContextBlock } from "@/lib/glossary";
import type { GlossaryTerm } from "@/lib/glossary";

const WELL_FORMED = `# Domain glossary

Some prose that is not a term and must be ignored.

## Terms

- **run** (session): one interactive CLI session in a PTY against an issue.
- **issue** (task, ticket): one unit of work on the kanban.
- **worktree**: the per-issue git worktree a run owns.
`;

describe("parseGlossary", () => {
  it("returns N terms from a well-formed multi-entry string", () => {
    const terms = parseGlossary(WELL_FORMED);
    expect(terms).toHaveLength(3);
    expect(terms[0]).toEqual({
      term: "run",
      definition: "one interactive CLI session in a PTY against an issue.",
      aliases: ["session"],
    });
    expect(terms[1].aliases).toEqual(["task", "ticket"]);
    // A term without an aliases group parses with no aliases key.
    expect(terms[2]).toEqual({
      term: "worktree",
      definition: "the per-issue git worktree a run owns.",
    });
  });

  it("returns [] from empty and whitespace-only input", () => {
    expect(parseGlossary("")).toEqual([]);
    expect(parseGlossary("   \n\t  \n")).toEqual([]);
  });

  it("skips a malformed line without throwing and keeps the valid terms", () => {
    const mixed = `- **good** (g): a valid entry.
- **broken** missing the colon and definition
- not even close to the format
- **empty-def**:
- **also-good**: another valid entry.
`;
    let terms: GlossaryTerm[] = [];
    expect(() => {
      terms = parseGlossary(mixed);
    }).not.toThrow();
    expect(terms).toHaveLength(2);
    expect(terms.map((t) => t.term)).toEqual(["good", "also-good"]);
  });
});

describe("glossaryContextBlock", () => {
  const terms: GlossaryTerm[] = [
    { term: "run", definition: "an interactive CLI session.", aliases: ["session"] },
    { term: "issue", definition: "a unit of work on the kanban.", aliases: ["task"] },
    { term: "worktree", definition: "the per-issue git checkout." },
  ];

  it("never exceeds the budget for a generous budget", () => {
    const out = glossaryContextBlock(terms, 1000);
    expect(out.length).toBeLessThanOrEqual(1000);
    expect(out).toContain("run");
    expect(out).toContain("worktree");
  });

  it("never exceeds a tight budget that forces truncation", () => {
    for (const budget of [1, 10, 40, 60, 80, 120]) {
      const out = glossaryContextBlock(terms, budget);
      expect(out.length).toBeLessThanOrEqual(budget);
    }
  });

  it("drops whole terms when truncating rather than splitting a line", () => {
    // Budget large enough for the header plus the first term, not the rest.
    const headerPlusFirst = glossaryContextBlock(terms, 1000)
      .split("\n")
      .slice(0, 2)
      .join("\n");
    const out = glossaryContextBlock(terms, headerPlusFirst.length);
    expect(out).toBe(headerPlusFirst);
    expect(out.length).toBeLessThanOrEqual(headerPlusFirst.length);
  });

  it("returns '' for budget <= 0 and for an empty terms array", () => {
    expect(glossaryContextBlock(terms, 0)).toBe("");
    expect(glossaryContextBlock(terms, -5)).toBe("");
    expect(glossaryContextBlock([], 1000)).toBe("");
  });

  it("returns '' when even the header plus one term would exceed budget", () => {
    expect(glossaryContextBlock(terms, 5)).toBe("");
  });
});
