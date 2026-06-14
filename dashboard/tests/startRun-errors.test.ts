import { TEST_REPO_ROOT, cleanupTestRepoRoot } from "./helpers/repoRootStub";
import { describe, it, expect, beforeEach, afterEach, afterAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { openDb, closeDb } from "@/lib/db";
import { createIssue } from "@/lib/issues";
import { startRunForIssue, StartRunError } from "@/lib/startRun";

// These guard that the run pipeline rejects bad inputs FAST with a typed,
// HTTP-mappable error (StartRunError.status), rather than hanging or throwing an
// opaque error. POST /api/runs maps the status directly and the Start button
// shows the message — so "stuck on Starting..." cannot come from these paths.
void TEST_REPO_ROOT; // imported for its import-time side effect (temp REPO_ROOT)

let tmp: string;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "agentic-startrun-err-"));
  openDb(path.join(tmp, "state.db"));
});

afterEach(() => {
  closeDb();
  fs.rmSync(tmp, { recursive: true, force: true });
});

afterAll(() => cleanupTestRepoRoot());

async function expectStartRunError(fn: () => Promise<unknown>, status: number) {
  let err: unknown;
  const start = Date.now();
  try {
    await fn();
  } catch (e) {
    err = e;
  }
  expect(Date.now() - start).toBeLessThan(10_000); // fails fast, no hang
  expect(err).toBeInstanceOf(StartRunError);
  expect((err as StartRunError).status).toBe(status);
}

describe("startRunForIssue fails fast with typed errors", () => {
  it("404 when the issue does not exist", async () => {
    await expectStartRunError(() => startRunForIssue(99999), 404);
  });

  it("400 when the issue has no assignee", async () => {
    const id = createIssue({ projectSlug: "x", title: "t", status: "queued" });
    await expectStartRunError(() => startRunForIssue(id), 400);
  });

  it("404 when the project does not exist", async () => {
    const id = createIssue({ projectSlug: "ghost", title: "t", assigneeSlug: "some-agent", status: "queued" });
    await expectStartRunError(() => startRunForIssue(id), 404);
  });

  it("StartRunError carries the HTTP status the API route maps directly", () => {
    const e = new StartRunError("boom", 503);
    expect(e).toBeInstanceOf(Error);
    expect(e.name).toBe("StartRunError");
    expect(e.status).toBe(503);
  });
});
