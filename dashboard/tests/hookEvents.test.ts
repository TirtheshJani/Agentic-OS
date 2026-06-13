import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { openDb, closeDb } from "@/lib/db";
import { createIssue } from "@/lib/issues";
import { createRun } from "@/lib/runs";
import { recordHookEvent, listHookEvents } from "@/lib/hookEvents";

let tmp: string;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "agentic-hookev-"));
  openDb(path.join(tmp, "state.db"));
});

afterEach(() => {
  closeDb();
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe("hook events", () => {
  it("records and lists events newest-first with parsed payload", () => {
    const issueId = createIssue({ projectSlug: "p", title: "t", status: "running" });
    const runId = createRun({ issueId, agentSlug: "a", runtimeId: "gemini-cli", worktreePath: "/w" });

    recordHookEvent({
      runId,
      eventType: "SessionStart",
      payload: { synthetic: true, runtimeId: "gemini-cli", detail: "spawned" },
    });
    recordHookEvent({
      runId,
      eventType: "SessionEnd",
      payload: { synthetic: true, runtimeId: "gemini-cli", detail: "run done" },
    });

    const events = listHookEvents();
    expect(events).toHaveLength(2);
    expect(events[0].eventType).toBe("SessionEnd"); // newest first
    expect(events[0].payload.synthetic).toBe(true);
    // joined run/issue context
    expect(events[0].runtimeId).toBe("gemini-cli");
    expect(events[0].issueId).toBe(issueId);
    expect(events[0].issueTitle).toBe("t");
    expect(events[0].projectSlug).toBe("p");
  });

  it("distinguishes real hook events from synthetic ones", () => {
    const issueId = createIssue({ projectSlug: "p", title: "t", status: "running" });
    const runId = createRun({ issueId, agentSlug: "a", runtimeId: "claude-code", worktreePath: "/w" });

    recordHookEvent({
      runId,
      sessionId: "sid-1",
      eventType: "SessionStart",
      payload: { synthetic: false, runtimeId: "claude-code", detail: "SessionStart hook" },
    });

    const [event] = listHookEvents();
    expect(event.payload.synthetic).toBe(false);
    expect(event.sessionId).toBe("sid-1");
  });

  it("respects the limit", () => {
    const issueId = createIssue({ projectSlug: "p", title: "t", status: "running" });
    const runId = createRun({ issueId, agentSlug: "a", runtimeId: "gemini-cli", worktreePath: "/w" });
    for (let i = 0; i < 5; i++) {
      recordHookEvent({ runId, eventType: "SessionEnd", payload: { synthetic: true } });
    }
    expect(listHookEvents({ limit: 3 })).toHaveLength(3);
  });
});
