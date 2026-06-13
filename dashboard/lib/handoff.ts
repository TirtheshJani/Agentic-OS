// dashboard/lib/handoff.ts
// Parse the structured `HANDOFF.md` an agent writes to its worktree at the end
// of a run (spec 0029 / ADR-022). `finalizeRun` reads it before the worktree is
// pruned, emits it as a `run.handoff` thread event, and the judge reads it as
// grading context. A missing file is not an error: parseHandoff returns null and
// grading proceeds on the generic signals.
//
// HANDOFF.md schema (all sections optional; unknown sections are ignored):
//
//   # Handoff
//
//   ## Completed
//   What this run actually finished.
//
//   ## Remaining
//   What is left for the next run or a human.
//
//   ## Commands run
//   - `npm test` exit 0
//   - `npm run build` exit 1
//
//   ## Issues discovered
//   Anything surprising found along the way.
//
//   ## Assertions
//   - [x] First acceptance assertion :: verified by tests/foo.test.ts
//   - [ ] Second acceptance assertion :: not reached this run
//
// Commands carry a trailing `exit N`; assertions are a checkbox plus an optional
// `::`-separated reason (an em dash separator is also tolerated for agents that
// write one).
import fs from "node:fs";
import path from "node:path";
import { splitH2Sections } from "@/lib/markdown";

export interface HandoffCommand {
  command: string;
  exitCode: number | null;
}

export interface HandoffAssertion {
  text: string;
  pass: boolean;
  reason: string;
}

export interface Handoff {
  completed: string;
  remaining: string;
  commands: HandoffCommand[];
  issues: string;
  assertions: HandoffAssertion[];
  raw: string;
}

const COMMAND_RE = /^\s*-\s+(.*\S)\s*$/;
const SELF_ASSERT_RE = /^\s*-\s*\[([ xX])\]\s+(.+?)\s*$/;

function parseCommands(body: string): HandoffCommand[] {
  const out: HandoffCommand[] = [];
  for (const line of body.split(/\r?\n/)) {
    const item = line.match(COMMAND_RE);
    if (!item) continue;
    let text = item[1].trim();
    let exitCode: number | null = null;
    const exit = text.match(/\bexit\s+(-?\d+)\s*$/i);
    if (exit) {
      exitCode = Number(exit[1]);
      text = text.slice(0, exit.index).trim();
    }
    text = text.replace(/^`(.+)`$/, "$1").trim();
    if (text) out.push({ command: text, exitCode });
  }
  return out;
}

function parseSelfAssertions(body: string): HandoffAssertion[] {
  const out: HandoffAssertion[] = [];
  for (const line of body.split(/\r?\n/)) {
    const m = line.match(SELF_ASSERT_RE);
    if (!m) continue;
    const pass = m[1].toLowerCase() === "x";
    const parts = m[2].trim().split(/\s+(?:::|—)\s+/);
    const text = parts[0].trim();
    const reason = parts.length > 1 ? parts.slice(1).join(" ").trim() : "";
    if (text) out.push({ text, pass, reason });
  }
  return out;
}

function sectionBody(sections: { heading: string; body: string }[], ...names: string[]): string {
  const wanted = names.map((n) => n.toLowerCase());
  const match = sections.find((s) => wanted.includes(s.heading.toLowerCase()));
  return match ? match.body.trim() : "";
}

/** Parse `HANDOFF.md` from a worktree, or null when the file is absent. */
export function parseHandoff(worktreePath: string): Handoff | null {
  const fp = path.join(worktreePath, "HANDOFF.md");
  let raw: string;
  try {
    if (!fs.existsSync(fp)) return null;
    raw = fs.readFileSync(fp, "utf8");
  } catch {
    return null;
  }
  const sections = splitH2Sections(raw);
  return {
    completed: sectionBody(sections, "completed"),
    remaining: sectionBody(sections, "remaining"),
    commands: parseCommands(sectionBody(sections, "commands run", "commands")),
    issues: sectionBody(sections, "issues discovered", "issues"),
    assertions: parseSelfAssertions(sectionBody(sections, "assertions", "self-assessment")),
    raw,
  };
}

/** A compact, readable rendering for the thread event and the judge prompt. */
export function renderHandoff(h: Handoff): string {
  const lines: string[] = [];
  if (h.completed) lines.push(`Completed: ${h.completed}`);
  if (h.remaining) lines.push(`Remaining: ${h.remaining}`);
  if (h.commands.length) {
    lines.push("Commands:");
    for (const c of h.commands) lines.push(`  - ${c.command}${c.exitCode == null ? "" : ` (exit ${c.exitCode})`}`);
  }
  if (h.issues) lines.push(`Issues discovered: ${h.issues}`);
  if (h.assertions.length) {
    lines.push("Self-assessment:");
    for (const a of h.assertions) {
      lines.push(`  - [${a.pass ? "x" : " "}] ${a.text}${a.reason ? ` (${a.reason})` : ""}`);
    }
  }
  return lines.join("\n") || "(handoff present but empty)";
}
