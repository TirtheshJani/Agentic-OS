import { TEST_REPO_ROOT, cleanupTestRepoRoot } from "./helpers/repoRootStub";
import { describe, it, expect, beforeEach, afterEach, afterAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { openDb, closeDb } from "@/lib/db";
import { createIssue } from "@/lib/issues";
import { createRun } from "@/lib/runs";
import { finalizeRunExit } from "@/lib/startRun";
import { parseHandoff } from "@/lib/handoff";
import { readThread } from "@/lib/threads";

// Thread files land under the stubbed repo root's vault, not the per-test tmp,
// so wipe them between tests; the in-memory DB resets issue ids to 1 each time.
const VAULT_PROJECTS = path.join(TEST_REPO_ROOT, "vault", "projects");

let tmp: string;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "agentic-handoff-"));
  fs.rmSync(VAULT_PROJECTS, { recursive: true, force: true });
  openDb(path.join(tmp, "state.db"));
});

afterEach(() => {
  closeDb();
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.rmSync(VAULT_PROJECTS, { recursive: true, force: true });
});

afterAll(() => {
  cleanupTestRepoRoot();
});

const SAMPLE = [
  "# Handoff",
  "",
  "## Completed",
  "Wired the parser and added tests.",
  "",
  "## Remaining",
  "Docs still to write.",
  "",
  "## Commands run",
  "- `npm test` exit 0",
  "- `npm run build` exit 1",
  "",
  "## Issues discovered",
  "Found a flaky timer in the suite.",
  "",
  "## Assertions",
  "- [x] Parser returns assertions :: covered by unit test",
  "- [ ] Docs updated :: not this run",
  "",
].join("\n");

function newWorktree(withHandoff: boolean): string {
  const wt = fs.mkdtempSync(path.join(tmp, "wt-"));
  if (withHandoff) fs.writeFileSync(path.join(wt, "HANDOFF.md"), SAMPLE);
  return wt;
}

describe("parseHandoff", () => {
  it("parses each documented section", () => {
    const h = parseHandoff(newWorktree(true));
    expect(h).not.toBeNull();
    expect(h!.completed).toBe("Wired the parser and added tests.");
    expect(h!.remaining).toBe("Docs still to write.");
    expect(h!.commands).toEqual([
      { command: "npm test", exitCode: 0 },
      { command: "npm run build", exitCode: 1 },
    ]);
    expect(h!.issues).toContain("flaky timer");
    expect(h!.assertions).toEqual([
      { text: "Parser returns assertions", pass: true, reason: "covered by unit test" },
      { text: "Docs updated", pass: false, reason: "not this run" },
    ]);
  });

  it("returns null when HANDOFF.md is absent", () => {
    expect(parseHandoff(newWorktree(false))).toBeNull();
  });
});

describe("finalizeRun handoff event", () => {
  it("emits exactly one run.handoff event with the rendered summary when a handoff exists", () => {
    const wt = newWorktree(true);
    const issueId = createIssue({ projectSlug: "p", title: "t", status: "running" });
    const runId = createRun({ issueId, agentSlug: "a", runtimeId: "claude-code", worktreePath: wt });
    finalizeRunExit(runId, 0);

    const events = readThread("p", issueId).filter((e) => e.eventType === "run.handoff");
    expect(events).toHaveLength(1);
    expect(events[0].body).toContain("Completed: Wired the parser");
    expect(events[0].body).toContain("(exit 1)");
  });

  it("emits a no-handoff note and still finalizes when HANDOFF.md is missing", () => {
    const wt = newWorktree(false);
    const issueId = createIssue({ projectSlug: "p", title: "t", status: "running" });
    const runId = createRun({ issueId, agentSlug: "a", runtimeId: "claude-code", worktreePath: wt });
    finalizeRunExit(runId, 0);

    const thread = readThread("p", issueId);
    const handoff = thread.filter((e) => e.eventType === "run.handoff");
    expect(handoff).toHaveLength(1);
    expect(handoff[0].body).toBe("(no handoff written)");
    // Finalization still completed alongside the handoff note.
    expect(thread.filter((e) => e.eventType === "run.done")).toHaveLength(1);
  });
});
