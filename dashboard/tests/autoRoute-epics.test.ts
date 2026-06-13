import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import type Database from "better-sqlite3";

// vi.mock factories are hoisted above top-level consts, so the shared spies are
// created via vi.hoisted and referenced inside the factories below.
const { startRunForIssue, appendEvent } = vi.hoisted(() => ({
  // startRunForIssue: mocked so no real spawn/worktree happens; the test only
  // asserts whether the auto-router reached the "start" step for a given issue.
  startRunForIssue: vi.fn(async (_issueId: number) => {}),
  // appendEvent: mocked so held-event assertions are observable and the vault
  // filesystem stays untouched.
  appendEvent: vi.fn(),
}));
vi.mock("@/lib/startRun", () => ({ startRunForIssue }));
vi.mock("@/lib/threads", () => ({ appendEvent }));

// getProject reads PROJECT.md off the vault filesystem; stub it so any seeded
// issue resolves to a project without touching the real vault.
vi.mock("@/lib/projects", () => ({
  getProject: (slug: string) => ({ slug, name: slug, capabilities: [] }),
}));

import { openDb, closeDb, getDb } from "@/lib/db";
import { getSettings, setSettings, resetSettingsForTesting } from "@/lib/settings";
import { resetBusForTesting } from "@/lib/stream";
import { createEpic } from "@/lib/epics";
// Imported after the mocks above are registered so handleIssue picks them up.
import { handleIssue } from "@/lib/orchestrator/autoRoute";

let tmp: string;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "agentic-autoroute-epic-"));
  process.env.AGENTIC_OS_STATE_DIR = tmp;
  openDb(path.join(tmp, "state.db"));
  resetSettingsForTesting();
  resetBusForTesting();
  startRunForIssue.mockClear();
  appendEvent.mockClear();
  // Autonomy must be on or handleIssue returns immediately.
  setSettings({ autonomy: { ...getSettings().autonomy, enabled: true } });
});

afterEach(() => {
  closeDb();
  fs.rmSync(tmp, { recursive: true, force: true });
  delete process.env.AGENTIC_OS_STATE_DIR;
});

// Insert a queued issue with a pre-set assignee so routeIssue is a no-op and
// handleIssue proceeds straight to the start step. epicId/dependsOn map to the
// v10 issues columns.
function seedIssue(
  db: Database.Database,
  opts: { title: string; epicId?: number | null; dependsOn?: number[]; status?: string }
): number {
  const now = Date.now();
  const info = db
    .prepare(
      `INSERT INTO issues
         (project_slug, title, body, assignee_slug, status, epic_id, depends_on, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      "demo",
      opts.title,
      "",
      "worker", // non-lead assignee: routing is skipped
      opts.status ?? "queued",
      opts.epicId ?? null,
      opts.dependsOn ? JSON.stringify(opts.dependsOn) : null,
      now,
      now
    );
  return Number(info.lastInsertRowid);
}

describe("auto-router epic dependency gate (spec 0034 / ADR-027)", () => {
  it("holds a child with an unmet dependency and starts its independent sibling", async () => {
    const db = getDb();
    const epicId = createEpic({ projectSlug: "demo", title: "epic" });
    // An upstream dependency that has NOT passed (status running, no contract).
    const dep = seedIssue(db, { title: "dep", epicId, status: "running" });
    // Child A depends on the unmet dep -> must be held.
    const childA = seedIssue(db, { title: "A-blocked", epicId, dependsOn: [dep] });
    // Child B is independent -> must start.
    const childB = seedIssue(db, { title: "B-free", epicId });

    const inFlight = new Set<number>();
    await handleIssue(childA, inFlight);
    await handleIssue(childB, inFlight);

    const startedIds = startRunForIssue.mock.calls.map((c) => c[0]);
    expect(startedIds).not.toContain(childA);
    expect(startedIds).toContain(childB);

    // A held event was appended for the blocked child.
    const heldForA = appendEvent.mock.calls.some(
      (c) => c[0].issueId === childA && c[0].eventType === "orchestrator.held"
    );
    expect(heldForA).toBe(true);

    // A held child never occupies an in-flight slot (gate runs before add).
    expect(inFlight.has(childA)).toBe(false);
  });

  it("starts a non-epic queued issue exactly as before (regression guard)", async () => {
    const db = getDb();
    const plain = seedIssue(db, { title: "plain", epicId: null });

    const inFlight = new Set<number>();
    await handleIssue(plain, inFlight);

    const startedIds = startRunForIssue.mock.calls.map((c) => c[0]);
    expect(startedIds).toContain(plain);
    // No held event for a non-epic issue.
    const held = appendEvent.mock.calls.some(
      (c) => c[0].issueId === plain && c[0].eventType === "orchestrator.held"
    );
    expect(held).toBe(false);
  });
});
