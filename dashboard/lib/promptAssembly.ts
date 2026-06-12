// dashboard/lib/promptAssembly.ts
// Worktree context injection (spec 0014). Both runtimes collapse the initial
// prompt to one PTY line, so project instructions and knowledge chunks go into
// a context file in the worktree instead; the prompt gets one pointer line.
// Claude Code auto-reads <cwd>/CLAUDE.md and Gemini CLI reads <cwd>/GEMINI.md,
// so instructions are also merge-appended there.
import fs from "node:fs";
import path from "node:path";
import type { RetrievedChunk } from "@/lib/rag/retrieval";

const CONTEXT_FILE = "AGENT_CONTEXT.md";
const MAX_CONTEXT_CHARS = 12_000;
const SECTION_MARKER = "## Project instructions (Agentic-OS)";

export interface WorktreeContextParts {
  contextFileBody: string;
  promptSuffix: string;
  instructionsSection: string;
}

export function buildWorktreeContext(opts: {
  projectSlug: string;
  issueTitle: string;
  instructions: string;
  chunks: RetrievedChunk[];
  agentSystemPrompt?: string;
}): WorktreeContextParts {
  const agentPrompt = opts.agentSystemPrompt?.trim() ?? "";
  const sections: string[] = [`# Agent context for ${opts.projectSlug}`, ""];

  // Agent profile goes first so the size cap truncates knowledge chunks
  // before it.
  if (agentPrompt) {
    sections.push("## Agent profile", "", agentPrompt, "");
  }

  if (opts.instructions.trim()) {
    sections.push("## Project instructions", "", opts.instructions.trim(), "");
  }

  if (opts.chunks.length > 0) {
    sections.push("## Relevant project knowledge", "");
    for (const c of opts.chunks) {
      sections.push(`### ${c.title}${c.heading ? ` — ${c.heading}` : ""} (vault: ${c.notePath})`, "", c.content, "");
    }
  }

  sections.push(
    "## Artifacts convention",
    "",
    `Write finished deliverables (reports, documents, exports) to the vault folder vault/projects/${opts.projectSlug}/outputs/ by absolute path; code changes stay in this worktree.`,
    ""
  );

  let contextFileBody = sections.join("\n");
  if (contextFileBody.length > MAX_CONTEXT_CHARS) {
    contextFileBody = `${contextFileBody.slice(0, MAX_CONTEXT_CHARS)}\n\n(truncated)`;
  }

  const memoryParts: string[] = [];
  if (agentPrompt) memoryParts.push(`### Agent profile\n\n${agentPrompt}`);
  if (opts.instructions.trim()) memoryParts.push(opts.instructions.trim());
  const instructionsSection = memoryParts.length > 0
    ? `\n\n${SECTION_MARKER}\n\n${memoryParts.join("\n\n")}\n`
    : "";

  return {
    contextFileBody,
    promptSuffix: ` Read ${CONTEXT_FILE} in this directory before starting; it contains your agent profile, project instructions, and relevant knowledge.`,
    instructionsSection,
  };
}

/**
 * Write AGENT_CONTEXT.md and merge-append instructions into the runtime's
 * memory file (CLAUDE.md / GEMINI.md) without clobbering existing content.
 */
export function installWorktreeContext(worktreePath: string, runtimeId: string, parts: WorktreeContextParts): void {
  fs.writeFileSync(path.join(worktreePath, CONTEXT_FILE), parts.contextFileBody);

  if (!parts.instructionsSection) return;
  // Each runtime auto-reads a different memory file from the worktree root.
  // agy follows the cross-tool AGENTS.md convention; the AGENT_CONTEXT.md
  // prompt pointer is the primary channel regardless.
  const memoryFile =
    runtimeId === "gemini-cli" ? "GEMINI.md" :
    runtimeId === "antigravity-cli" ? "AGENTS.md" :
    "CLAUDE.md";
  const memoryPath = path.join(worktreePath, memoryFile);
  const existing = fs.existsSync(memoryPath) ? fs.readFileSync(memoryPath, "utf8") : "";
  if (existing.includes(SECTION_MARKER)) return; // already installed (idempotent)
  fs.writeFileSync(memoryPath, existing + parts.instructionsSection);
}
