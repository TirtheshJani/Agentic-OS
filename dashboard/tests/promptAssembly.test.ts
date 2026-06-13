import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildWorktreeContext, installWorktreeContext } from "@/lib/promptAssembly";
import type { RetrievedChunk } from "@/lib/rag/retrieval";

const CHUNK: RetrievedChunk = {
  notePath: "projects/p1/knowledge/spec.md",
  title: "Spec",
  heading: "Goals",
  chunkIndex: 0,
  content: "The system must do X.",
  score: 0.02,
  retrievers: ["vector"],
};

let worktree: string;

beforeEach(() => {
  worktree = fs.mkdtempSync(path.join(os.tmpdir(), "agentic-wt-"));
});

afterEach(() => {
  fs.rmSync(worktree, { recursive: true, force: true });
});

describe("buildWorktreeContext", () => {
  it("includes instructions, chunk provenance, and the artifacts convention", () => {
    const parts = buildWorktreeContext({
      projectSlug: "p1",
      issueTitle: "Do the thing",
      instructions: "Use strict mode.",
      chunks: [CHUNK],
    });
    expect(parts.contextFileBody).toContain("## Project instructions");
    expect(parts.contextFileBody).toContain("Use strict mode.");
    expect(parts.contextFileBody).toContain("(vault: projects/p1/knowledge/spec.md)");
    expect(parts.contextFileBody).toContain("vault/projects/p1/outputs/");
    expect(parts.promptSuffix).not.toContain("\n");
    expect(parts.promptSuffix).toContain("AGENT_CONTEXT.md");
  });

  it("puts the agent profile first in the context body and in the memory section", () => {
    const parts = buildWorktreeContext({
      projectSlug: "p1",
      issueTitle: "t",
      instructions: "Use strict mode.",
      chunks: [CHUNK],
      agentSystemPrompt: "You are the research lead. Always cite sources.",
    });
    const profileIdx = parts.contextFileBody.indexOf("## Agent profile");
    expect(profileIdx).toBeGreaterThan(-1);
    expect(profileIdx).toBeLessThan(parts.contextFileBody.indexOf("## Project instructions"));
    expect(parts.contextFileBody).toContain("Always cite sources.");
    expect(parts.instructionsSection).toContain("### Agent profile");
    expect(parts.instructionsSection).toContain("Always cite sources.");
    expect(parts.instructionsSection).toContain("Use strict mode.");
  });

  it("omits the agent profile when the prompt is empty or absent", () => {
    const absent = buildWorktreeContext({ projectSlug: "p1", issueTitle: "t", instructions: "Rule.", chunks: [] });
    expect(absent.contextFileBody).not.toContain("Agent profile");
    const blank = buildWorktreeContext({
      projectSlug: "p1",
      issueTitle: "t",
      instructions: "",
      chunks: [],
      agentSystemPrompt: "   ",
    });
    expect(blank.contextFileBody).not.toContain("Agent profile");
    expect(blank.instructionsSection).toBe("");
  });

  it("survives the size cap when chunks are huge (profile is before chunks)", () => {
    const big: RetrievedChunk = { ...CHUNK, content: "y".repeat(50_000) };
    const parts = buildWorktreeContext({
      projectSlug: "p1",
      issueTitle: "t",
      instructions: "",
      chunks: [big],
      agentSystemPrompt: "You are the research lead.",
    });
    expect(parts.contextFileBody).toContain("You are the research lead.");
    expect(parts.contextFileBody).toContain("(truncated)");
  });

  it("caps the context body size", () => {
    const big: RetrievedChunk = { ...CHUNK, content: "y".repeat(50_000) };
    const parts = buildWorktreeContext({
      projectSlug: "p1",
      issueTitle: "t",
      instructions: "",
      chunks: [big],
    });
    expect(parts.contextFileBody.length).toBeLessThan(13_000);
    expect(parts.contextFileBody).toContain("(truncated)");
  });

  it("is byte-identical with no glossaryBlock vs an absent/empty one (regression guard)", () => {
    const base = {
      projectSlug: "p1",
      issueTitle: "Do the thing",
      instructions: "Use strict mode.",
      chunks: [CHUNK],
      agentSystemPrompt: "You are the research lead.",
    };
    const absent = buildWorktreeContext(base);
    const emptyString = buildWorktreeContext({ ...base, glossaryBlock: "" });
    const whitespace = buildWorktreeContext({ ...base, glossaryBlock: "   \n  " });
    expect(absent.contextFileBody).not.toContain("## Shared glossary");
    expect(emptyString.contextFileBody).toBe(absent.contextFileBody);
    expect(whitespace.contextFileBody).toBe(absent.contextFileBody);
  });

  it("prepends a Shared glossary section near the top when a glossaryBlock is given", () => {
    const block = "Glossary (shared vocabulary):\n- run (aka session): one CLI session.";
    const parts = buildWorktreeContext({
      projectSlug: "p1",
      issueTitle: "t",
      instructions: "Use strict mode.",
      chunks: [CHUNK],
      agentSystemPrompt: "You are the research lead.",
      glossaryBlock: block,
    });
    expect(parts.contextFileBody).toContain("## Shared glossary");
    expect(parts.contextFileBody).toContain(block);
    // After the agent profile, before project instructions and knowledge.
    const glossaryIdx = parts.contextFileBody.indexOf("## Shared glossary");
    expect(parts.contextFileBody.indexOf("## Agent profile")).toBeLessThan(glossaryIdx);
    expect(glossaryIdx).toBeLessThan(parts.contextFileBody.indexOf("## Project instructions"));
    expect(glossaryIdx).toBeLessThan(parts.contextFileBody.indexOf("## Relevant project knowledge"));
  });

  it("keeps the cap when a glossaryBlock is present alongside huge chunks", () => {
    const big: RetrievedChunk = { ...CHUNK, content: "y".repeat(50_000) };
    const parts = buildWorktreeContext({
      projectSlug: "p1",
      issueTitle: "t",
      instructions: "",
      chunks: [big],
      glossaryBlock: "Glossary (shared vocabulary):\n- run: one CLI session.",
    });
    expect(parts.contextFileBody.length).toBeLessThan(13_000);
    expect(parts.contextFileBody).toContain("(truncated)");
  });
});

describe("installWorktreeContext", () => {
  it("writes AGENT_CONTEXT.md and appends instructions to CLAUDE.md without clobbering", () => {
    fs.writeFileSync(path.join(worktree, "CLAUDE.md"), "# Existing repo guidance\n");
    const parts = buildWorktreeContext({
      projectSlug: "p1",
      issueTitle: "t",
      instructions: "Project rule.",
      chunks: [],
    });
    installWorktreeContext(worktree, "claude-code", parts);

    expect(fs.existsSync(path.join(worktree, "AGENT_CONTEXT.md"))).toBe(true);
    const claudeMd = fs.readFileSync(path.join(worktree, "CLAUDE.md"), "utf8");
    expect(claudeMd.startsWith("# Existing repo guidance")).toBe(true);
    expect(claudeMd).toContain("Project rule.");

    // Idempotent: a second install doesn't duplicate the section.
    installWorktreeContext(worktree, "claude-code", parts);
    const again = fs.readFileSync(path.join(worktree, "CLAUDE.md"), "utf8");
    expect(again.match(/Project instructions \(Agentic-OS\)/g)?.length).toBe(1);
  });

  it("appends the agent profile to the memory file when there are no project instructions", () => {
    const parts = buildWorktreeContext({
      projectSlug: "p1",
      issueTitle: "t",
      instructions: "",
      chunks: [],
      agentSystemPrompt: "You are the coding lead.",
    });
    installWorktreeContext(worktree, "claude-code", parts);
    const claudeMd = fs.readFileSync(path.join(worktree, "CLAUDE.md"), "utf8");
    expect(claudeMd).toContain("### Agent profile");
    expect(claudeMd).toContain("You are the coding lead.");

    installWorktreeContext(worktree, "claude-code", parts);
    const again = fs.readFileSync(path.join(worktree, "CLAUDE.md"), "utf8");
    expect(again.match(/### Agent profile/g)?.length).toBe(1);
  });

  it("targets GEMINI.md for the gemini runtime and skips the memory file without instructions", () => {
    const withInstr = buildWorktreeContext({ projectSlug: "p1", issueTitle: "t", instructions: "Rule.", chunks: [] });
    installWorktreeContext(worktree, "gemini-cli", withInstr);
    expect(fs.existsSync(path.join(worktree, "GEMINI.md"))).toBe(true);
    expect(fs.existsSync(path.join(worktree, "CLAUDE.md"))).toBe(false);

    const noInstr = buildWorktreeContext({ projectSlug: "p2", issueTitle: "t", instructions: "", chunks: [CHUNK] });
    const wt2 = fs.mkdtempSync(path.join(os.tmpdir(), "agentic-wt2-"));
    try {
      installWorktreeContext(wt2, "claude-code", noInstr);
      expect(fs.existsSync(path.join(wt2, "AGENT_CONTEXT.md"))).toBe(true);
      expect(fs.existsSync(path.join(wt2, "CLAUDE.md"))).toBe(false);
    } finally {
      fs.rmSync(wt2, { recursive: true, force: true });
    }
  });

  it("targets AGENTS.md for the antigravity runtime", () => {
    const withInstr = buildWorktreeContext({ projectSlug: "p1", issueTitle: "t", instructions: "Rule.", chunks: [] });
    installWorktreeContext(worktree, "antigravity-cli", withInstr);
    expect(fs.existsSync(path.join(worktree, "AGENTS.md"))).toBe(true);
    expect(fs.existsSync(path.join(worktree, "CLAUDE.md"))).toBe(false);
    expect(fs.existsSync(path.join(worktree, "GEMINI.md"))).toBe(false);
  });
});
