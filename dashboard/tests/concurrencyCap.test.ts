import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { openDb, closeDb } from "@/lib/db";
import { assertCapacity } from "@/lib/runtime/concurrencyCap";
import { createRun } from "@/lib/runs";
import { createIssue } from "@/lib/issues";
import { ConcurrencyCapError } from "@/lib/runtime/types";

let tmp: string;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "agentic-cap-"));
  openDb(path.join(tmp, "state.db"));
});

afterEach(() => {
  closeDb();
  fs.rmSync(tmp, { recursive: true, force: true });
});

function seedIssue(projectSlug: string): number {
  // Concurrency cap joins runs to issues by project_slug, so we need real issue rows.
  return createIssue({ projectSlug, title: "x", body: "" });
}

describe("assertCapacity", () => {
  it("passes when under both caps", () => {
    expect(() => assertCapacity({ projectSlug: "qml", perProjectMax: 3, globalMax: 5 })).not.toThrow();
  });

  it("throws ConcurrencyCapError at project cap", () => {
    const i = seedIssue("qml");
    createRun({ issueId: i, agentSlug: "a", runtimeId: "claude-code", worktreePath: "/w1" });
    createRun({ issueId: i, agentSlug: "a", runtimeId: "claude-code", worktreePath: "/w2" });
    createRun({ issueId: i, agentSlug: "a", runtimeId: "claude-code", worktreePath: "/w3" });
    expect(() => assertCapacity({ projectSlug: "qml", perProjectMax: 3, globalMax: 5 }))
      .toThrow(ConcurrencyCapError);
  });

  it("throws ConcurrencyCapError at global cap even if project is under", () => {
    const a = seedIssue("a"); const b = seedIssue("b"); const c = seedIssue("c");
    const d = seedIssue("d"); const e = seedIssue("e");
    for (const i of [a, b, c, d, e]) {
      createRun({ issueId: i, agentSlug: "x", runtimeId: "claude-code", worktreePath: `/w${i}` });
    }
    expect(() => assertCapacity({ projectSlug: "a", perProjectMax: 10, globalMax: 5 }))
      .toThrow(ConcurrencyCapError);
  });
});
