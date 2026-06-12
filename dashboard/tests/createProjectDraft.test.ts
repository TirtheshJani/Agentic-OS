import { describe, it, expect } from "vitest";
import {
  buildOrchestratorPrompt,
  parseOrchestratorDraft,
  sanitizeDraft,
  KNOWN_TOOLS,
  type OrchestratorDraft,
} from "@/lib/createProject/draft";

const VALID_DRAFT = {
  project: {
    name: "Moon Phase CLI",
    slug: "moon-phase-cli",
    description: "A CLI that prints the moon phase.",
    capabilities: ["cli", "astronomy"],
  },
  team: [
    {
      name: "moon-dev",
      slug: "moon-dev",
      description: "Implements the CLI.",
      skills: ["paper-search"],
      allowedTools: ["Read", "Write"],
      systemPrompt: "You are the developer.",
      runtime: "claude-code",
    },
    {
      name: "moon-reviewer",
      slug: "moon-reviewer",
      description: "Reviews changes.",
      skills: [],
      allowedTools: ["Read"],
      systemPrompt: "You review code.",
      runtime: "claude-code",
    },
  ],
  seedIssues: [
    { title: "Scaffold the CLI", body: "Set up the entry point." },
    { title: "Implement phase math", body: "Add the algorithm." },
  ],
};

describe("buildOrchestratorPrompt", () => {
  it("embeds the user prompt, skills, runtimes, and known tools", () => {
    const p = buildOrchestratorPrompt("Build a moon CLI", ["paper-search", "scan"], ["claude-code", "gemini-cli"]);
    expect(p).toContain("Build a moon CLI");
    expect(p).toContain("paper-search, scan");
    expect(p).toContain("claude-code, gemini-cli");
    for (const tool of KNOWN_TOOLS) expect(p).toContain(tool);
    expect(p).toContain("ONLY a JSON object");
  });
});

describe("parseOrchestratorDraft", () => {
  it("parses plain JSON", () => {
    const r = parseOrchestratorDraft(JSON.stringify(VALID_DRAFT));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.draft.project.slug).toBe("moon-phase-cli");
  });

  it("unwraps the claude -p {result} envelope", () => {
    const envelope = JSON.stringify({ type: "result", result: JSON.stringify(VALID_DRAFT) });
    const r = parseOrchestratorDraft(envelope);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.draft.team).toHaveLength(2);
  });

  it("strips markdown fences inside the envelope", () => {
    const fenced = "```json\n" + JSON.stringify(VALID_DRAFT) + "\n```";
    const envelope = JSON.stringify({ result: fenced });
    const r = parseOrchestratorDraft(envelope);
    expect(r.ok).toBe(true);
  });

  it("rejects garbage with a raw excerpt", () => {
    const r = parseOrchestratorDraft("I cannot help with that.");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.raw).toContain("I cannot help");
  });

  it("rejects JSON missing the team", () => {
    const r = parseOrchestratorDraft(JSON.stringify({ project: VALID_DRAFT.project, seedIssues: VALID_DRAFT.seedIssues }));
    expect(r.ok).toBe(false);
  });
});

describe("sanitizeDraft", () => {
  const knownSkills = new Set(["paper-search"]);
  const knownRuntimes = new Set(["claude-code", "gemini-cli"]);

  function clone(): OrchestratorDraft {
    return JSON.parse(JSON.stringify(VALID_DRAFT));
  }

  it("keeps a valid draft intact", () => {
    const { draft, warnings } = sanitizeDraft(clone(), knownSkills, knownRuntimes, "claude-code");
    expect(draft.team).toHaveLength(2);
    expect(draft.team[0].skills).toEqual(["paper-search"]);
    expect(warnings).toEqual([]);
  });

  it("drops hallucinated skills and tools with a warning", () => {
    const d = clone();
    d.team[0].skills = ["paper-search", "made-up-skill"];
    d.team[0].allowedTools = ["Read", "LaunchMissiles"];
    const { draft, warnings } = sanitizeDraft(d, knownSkills, knownRuntimes, "claude-code");
    expect(draft.team[0].skills).toEqual(["paper-search"]);
    expect(draft.team[0].allowedTools).toEqual(["Read"]);
    expect(warnings.some((w) => w.includes("made-up-skill"))).toBe(true);
  });

  it("trims oversized teams to 4 and seed issues to 5", () => {
    const d = clone();
    d.team = Array.from({ length: 6 }, (_, i) => ({ ...d.team[0], slug: `agent-${i}`, name: `agent-${i}` }));
    d.seedIssues = Array.from({ length: 8 }, (_, i) => ({ title: `Task ${i}`, body: "" }));
    const { draft, warnings } = sanitizeDraft(d, knownSkills, knownRuntimes, "claude-code");
    expect(draft.team).toHaveLength(4);
    expect(draft.seedIssues).toHaveLength(5);
    expect(warnings.some((w) => w.includes("trimmed"))).toBe(true);
  });

  it("replaces unknown runtimes with the fallback", () => {
    const d = clone();
    d.team[0].runtime = "codex";
    const { draft, warnings } = sanitizeDraft(d, knownSkills, knownRuntimes, "gemini-cli");
    expect(draft.team[0].runtime).toBe("gemini-cli");
    expect(warnings.some((w) => w.includes("codex"))).toBe(true);
  });

  it("slugifies sloppy slugs and dedupes team members", () => {
    const d = clone();
    d.project.slug = "Moon Phase CLI!";
    d.team[1].slug = d.team[0].slug;
    const { draft, warnings } = sanitizeDraft(d, knownSkills, knownRuntimes, "claude-code");
    expect(draft.project.slug).toBe("moon-phase-cli");
    expect(draft.team).toHaveLength(1);
    expect(warnings.some((w) => w.includes("duplicate"))).toBe(true);
  });

  it("warns on single-agent team but proceeds", () => {
    const d = clone();
    d.team = [d.team[0]];
    const { draft, warnings } = sanitizeDraft(d, knownSkills, knownRuntimes, "claude-code");
    expect(draft.team).toHaveLength(1);
    expect(warnings.some((w) => w.includes("single-agent"))).toBe(true);
  });

  it("dedupes, lowercases and caps capabilities at 6", () => {
    const d = clone();
    d.project.capabilities = ["CLI", "cli", "a", "b", "c", "d", "e", "f"];
    const { draft } = sanitizeDraft(d, knownSkills, knownRuntimes, "claude-code");
    expect(draft.project.capabilities).toHaveLength(6);
    expect(draft.project.capabilities[0]).toBe("cli");
  });
});
