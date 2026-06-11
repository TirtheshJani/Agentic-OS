import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createAgent, updateAgent, archiveAgent, AgentValidationError, type AgentInput } from "@/lib/agentMutations";
import { listAgents, getAgent } from "@/lib/agents";
import { registerRuntime, resetRegistryForTesting } from "@/lib/runtime/registry";
import type { Runtime } from "@/lib/runtime/types";

const fakeRuntime: Runtime = {
  id: "claude-code",
  displayName: "Fake Claude",
  capabilities: {
    sessionResume: true,
    sessionIdCapture: true,
    hooks: true,
    transcriptCostParsing: false,
    externalTerminalEscape: true,
  },
  detect: async () => ({ available: true, version: "0.0" }),
  spawn: async () => { throw new Error("not used"); },
  formatResumeCommand: (sid) => `claude --resume ${sid}`,
};

let agentsDir: string;
let skillsDir: string;

function baseInput(overrides: Partial<AgentInput> = {}): AgentInput {
  return {
    name: "newsletter-editor",
    slug: "newsletter-editor",
    description: "Edits newsletters",
    runtime: "claude-code",
    skills: ["paper-search"],
    allowedTools: ["Read", "Write"],
    systemPrompt: "You are the newsletter editor.",
    ...overrides,
  };
}

function opts() {
  return { rootDir: agentsDir, skillsRootDir: skillsDir };
}

beforeEach(() => {
  resetRegistryForTesting();
  registerRuntime(fakeRuntime);
  agentsDir = fs.mkdtempSync(path.join(os.tmpdir(), "agents-"));
  skillsDir = fs.mkdtempSync(path.join(os.tmpdir(), "skills-"));
  const skillDir = path.join(skillsDir, "research", "paper-search");
  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(
    path.join(skillDir, "SKILL.md"),
    `---\nname: paper-search\ndescription: Search papers.\nmetadata:\n  domain: research\n---\nbody\n`
  );
});

afterEach(() => {
  fs.rmSync(agentsDir, { recursive: true, force: true });
  fs.rmSync(skillsDir, { recursive: true, force: true });
});

describe("createAgent", () => {
  it("writes a file that round-trips through the agent parser", () => {
    const agent = createAgent(baseInput(), opts());
    expect(agent.slug).toBe("newsletter-editor");
    expect(agent.description).toBe("Edits newsletters");
    expect(agent.systemPrompt).toContain("newsletter editor");
    expect(agent["allowed-tools"]).toEqual(["Read", "Write"]);
    expect(agent.created).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(getAgent("newsletter-editor", agentsDir)?.name).toBe("newsletter-editor");
  });

  it("accepts a skill referenced by domain", () => {
    expect(() => createAgent(baseInput({ skills: ["research"] }), opts())).not.toThrow();
  });

  it("writes the model to frontmatter and drops blank models", () => {
    const withModel = createAgent(baseInput({ model: "sonnet" }), opts());
    expect(withModel.model).toBe("sonnet");
    const blank = createAgent(baseInput({ slug: "blank-model", name: "blank-model", model: "  " }), opts());
    expect(blank.model).toBeUndefined();
  });

  it("rejects duplicate slugs", () => {
    createAgent(baseInput(), opts());
    expect(() => createAgent(baseInput(), opts())).toThrow(AgentValidationError);
  });

  it("rejects bad slugs, unknown runtimes, and unknown skills", () => {
    expect(() => createAgent(baseInput({ slug: "Bad Slug" }), opts())).toThrow(/slug/);
    expect(() => createAgent(baseInput({ runtime: "nope" }), opts())).toThrow(/runtime/);
    expect(() => createAgent(baseInput({ skills: ["nope"] }), opts())).toThrow(/unknown skill/);
  });
});

describe("updateAgent", () => {
  it("merges a patch and preserves the created date", () => {
    const before = createAgent(baseInput(), opts());
    const after = updateAgent("newsletter-editor", { systemPrompt: "Updated prompt." }, opts());
    expect(after.systemPrompt).toBe("Updated prompt.");
    expect(after.created).toBe(before.created);
    expect(after.name).toBe(before.name);
  });

  it("sets, keeps, and clears the model across patches", () => {
    createAgent(baseInput(), opts());
    expect(updateAgent("newsletter-editor", { model: "opus" }, opts()).model).toBe("opus");
    // Absent = keep.
    expect(updateAgent("newsletter-editor", { name: "renamed" }, opts()).model).toBe("opus");
    // Explicit "" = clear.
    expect(updateAgent("newsletter-editor", { model: "" }, opts()).model).toBeUndefined();
  });

  it("rejects slug changes", () => {
    createAgent(baseInput(), opts());
    expect(() => updateAgent("newsletter-editor", { slug: "other" }, opts())).toThrow(/slug cannot/);
  });

  it("404s on missing agents", () => {
    expect(() => updateAgent("ghost", { name: "x" }, opts())).toThrow(/not found/);
  });
});

describe("archiveAgent", () => {
  it("moves the file out of the listing but keeps it on disk", () => {
    createAgent(baseInput(), opts());
    archiveAgent("newsletter-editor", opts());
    expect(listAgents(agentsDir)).toHaveLength(0);
    expect(fs.existsSync(path.join(agentsDir, "_archive", "newsletter-editor.md"))).toBe(true);
  });
});
