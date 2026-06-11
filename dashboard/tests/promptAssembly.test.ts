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
});
