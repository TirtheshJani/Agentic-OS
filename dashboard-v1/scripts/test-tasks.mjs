#!/usr/bin/env node
// Round-trip lifecycle test for the tasks table.
// Runs against a temp SQLite DB (not the dev DB).
// Exits 0 on pass, 1 on first assertion failure.

import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agentic-os-test-"));
const tmpDb = path.join(tmpDir, "state.db");
process.env.AGENTIC_OS_DB = path.relative(repoRoot, tmpDb);

// tsx handles .ts imports natively. Run via: tsx scripts/test-tasks.mjs
const { getDb, insertRun, finishRun } = await import("../lib/db.ts");
const tasks = await import("../lib/tasks.ts");

function assert(cond, msg) {
  if (!cond) {
    console.error(`FAIL  ${msg}`);
    process.exit(1);
  }
  console.log(`OK    ${msg}`);
}

try {
  getDb(); // triggers migration
  const id = tasks.createTask({ prompt: "test prompt", assignee: "lead:research", department: "research" });
  assert(id > 0, "createTask returns positive id");

  const initial = tasks.getTask(id);
  assert(initial?.status === "queued", "new task is queued");
  assert(initial?.department === "research", "department persisted");
  assert(initial?.parent_task_id === null, "no parent by default");

  const claimed = tasks.claimTask(id, "arxiv-watcher");
  assert(claimed?.status === "claimed", "claim moves to claimed");
  assert(claimed?.assignee === "arxiv-watcher", "claim updates assignee");

  const runId = insertRun({ skillSlug: "test", prompt: "p", agent: "arxiv-watcher" });
  const started = tasks.startTask(id, runId);
  assert(started?.status === "running", "start moves to running");
  assert(started?.run_id === runId, "run_id linked");

  finishRun(runId, "done", null, null, {});
  const done = tasks.finishTask(id, "done");
  assert(done?.status === "done", "finish moves to done");
  assert(done?.finished_at !== null, "finished_at stamped");

  const child = tasks.createTask({
    prompt: "follow-up",
    assignee: "lead:content",
    department: "content",
    parentTaskId: id,
  });
  const children = tasks.childrenOf(id);
  assert(children.length === 1 && children[0].id === child, "child task links to parent");

  let threw = false;
  try {
    tasks.claimTask(id, "x"); // already done
  } catch {
    threw = true;
  }
  assert(threw, "claim of done task throws");

  const queued = tasks.listTasks({ status: "queued" });
  assert(queued.length === 1 && queued[0].id === child, "listTasks filters by status");

  // Phase 7.3 + 8.1: round-trip the new issue/board fields.
  const issueId = tasks.createTask({
    prompt: "investigate flaky test in CI",
    assignee: "lead:research",
    department: "research",
    projectSlug: "fhir-rag-paper",
    title: "Flaky test: rag-retrieval",
    repo: "TirtheshJani/Agentic-OS",
    priority: "high",
    labels: ["bug", "p1"],
    githubUrl: "https://github.com/TirtheshJani/Agentic-OS/issues/42",
    githubNumber: 42,
  });
  const issue = tasks.getTask(issueId);
  assert(issue?.project_slug === "fhir-rag-paper", "project_slug persisted");
  assert(issue?.title === "Flaky test: rag-retrieval", "title persisted");
  assert(issue?.repo === "TirtheshJani/Agentic-OS", "repo persisted");
  assert(issue?.priority === "high", "priority persisted");
  assert(issue?.labels === JSON.stringify(["bug", "p1"]), "labels JSON-encoded");
  assert(
    issue?.github_url === "https://github.com/TirtheshJani/Agentic-OS/issues/42",
    "github_url persisted"
  );
  assert(issue?.github_number === 42, "github_number persisted");

  // Title fallback: missing title stays NULL (display-time fallback only).
  const noTitleId = tasks.createTask({
    prompt: "no title here",
    assignee: "lead:research",
  });
  const noTitle = tasks.getTask(noTitleId);
  assert(noTitle?.title === null, "missing title stored as null");
  assert(noTitle?.labels === null, "missing labels stored as null");
  assert(noTitle?.priority === null, "missing priority stored as null");

  // Empty labels array also stores NULL.
  const emptyLabelsId = tasks.createTask({
    prompt: "empty labels",
    assignee: "lead:research",
    labels: [],
  });
  const emptyLabels = tasks.getTask(emptyLabelsId);
  assert(emptyLabels?.labels === null, "empty labels array stored as null");

  console.log("\nALL PASS");
} finally {
  try {
    getDb().close();
  } catch {
    // ignore
  }
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  } catch {
    // best-effort cleanup; SQLite WAL handles on Windows may briefly hold the file
  }
}
