#!/usr/bin/env node
// Verifies task-runner fires /api/run POSTs for named-agent tasks and
// skips lead:* / user assignees. Uses a stub HTTP server in place of
// the real /api/run route. Exits 0 on pass, 1 on first failure.

import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import http from "node:http";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agentic-os-test-"));
const tmpDb = path.join(tmpDir, "state.db");
process.env.AGENTIC_OS_DB = path.relative(repoRoot, tmpDb);

const captured = [];
let resolveExpect = null;
let expectCount = 0;

const stub = http.createServer((req, res) => {
  if (req.method === "POST" && req.url === "/api/run") {
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => {
      try {
        captured.push(JSON.parse(body));
      } catch {
        captured.push({ _raw: body });
      }
      if (resolveExpect && captured.length >= expectCount) {
        const r = resolveExpect;
        resolveExpect = null;
        r();
      }
      // Stub returns an empty SSE stream that closes immediately.
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
      });
      res.end();
    });
    return;
  }
  res.writeHead(404);
  res.end();
});

await new Promise((r) => stub.listen(0, "127.0.0.1", r));
const port = stub.address().port;
process.env.AGENTIC_OS_BASE_URL = `http://127.0.0.1:${port}`;

const { getDb } = await import("../lib/db.ts");
const tasks = await import("../lib/tasks.ts");
const { spawnTaskIfNamed } = await import("../lib/task-runner.ts");

function assert(cond, msg) {
  if (!cond) {
    console.error(`FAIL  ${msg}`);
    process.exit(1);
  }
  console.log(`OK    ${msg}`);
}

function waitFor(n, timeoutMs = 2000) {
  return new Promise((resolve, reject) => {
    if (captured.length >= n) return resolve();
    expectCount = n;
    resolveExpect = resolve;
    setTimeout(() => reject(new Error(`timeout waiting for ${n} captures (have ${captured.length})`)), timeoutMs);
  });
}

try {
  getDb();

  // Case 1: createTask with named agent -> should NOT auto-fire here
  // (spawnTaskIfNamed is wired into the route layer, not lib/tasks). We
  // call it manually to simulate what the route does.
  const namedId = tasks.createTask({
    prompt: "summarize arxiv",
    assignee: "arxiv-watcher",
    department: "research",
  });
  const namedTask = tasks.getTask(namedId);
  spawnTaskIfNamed(namedTask);
  await waitFor(1);
  assert(captured.length === 1, "named-agent task triggers one POST");
  assert(captured[0].agent === "arxiv-watcher", "POST carries agent name");
  assert(captured[0].taskId === namedId, "POST carries taskId");
  assert(captured[0].prompt === "summarize arxiv", "POST carries prompt");

  // Case 2: lead:* assignee -> skipped silently
  const leadId = tasks.createTask({
    prompt: "route research queue",
    assignee: "lead:research",
    department: "research",
  });
  const leadTask = tasks.getTask(leadId);
  spawnTaskIfNamed(leadTask);
  // Give the runtime a beat in case a bug fires anyway.
  await new Promise((r) => setTimeout(r, 200));
  assert(captured.length === 1, "lead:* assignee does not trigger a POST");

  // Case 3: claim a queued lead:* task to a named agent -> claim route
  // logic is exercised by calling spawnTaskIfNamed(claimedRow).
  const claimedRow = tasks.claimTask(leadId, "arxiv-watcher");
  spawnTaskIfNamed(claimedRow);
  await waitFor(2);
  assert(captured.length === 2, "claim to named agent triggers a POST");
  assert(captured[1].taskId === leadId, "claim POST carries original task id");
  assert(captured[1].agent === "arxiv-watcher", "claim POST carries new assignee");

  // Case 4: user assignee -> skipped
  spawnTaskIfNamed({ id: 999, prompt: "x", assignee: "user" });
  await new Promise((r) => setTimeout(r, 200));
  assert(captured.length === 2, "user assignee does not trigger a POST");

  console.log("\nALL PASS");
} catch (e) {
  console.error(`FAIL  ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
} finally {
  try { getDb().close(); } catch {}
  await new Promise((r) => stub.close(() => r()));
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  } catch {
    // best-effort
  }
}
