#!/usr/bin/env node
// Round-trip test: thread file appends survive across reads.
// Uses real filesystem under a temp dir.

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agentic-os-thr-"));
const tmpDb = path.join(tmpDir, "state.db");
const tmpVault = path.join(tmpDir, "vault");
fs.mkdirSync(path.join(tmpVault, "threads"), { recursive: true });

process.env.AGENTIC_OS_DB = path.relative(repoRoot, tmpDb);
process.env.VAULT_PATH = path.relative(repoRoot, tmpVault);

// Run via: tsx scripts/test-threads.mjs
const { getDb } = await import("../lib/db.ts");
const tasks = await import("../lib/tasks.ts");

function assert(cond, msg) {
  if (!cond) {
    console.error(`FAIL  ${msg}`);
    process.exit(1);
  }
  console.log(`OK    ${msg}`);
}

try {
  getDb();
  const id = tasks.createTask({ prompt: "thread test", assignee: "lead:research" });
  const threadFile = path.join(tmpVault, "threads", `${id}.md`);

  fs.appendFileSync(threadFile, `[2026-05-14T10:00:00Z] research-lead: assigned to arxiv-watcher\n`);
  fs.appendFileSync(threadFile, `[2026-05-14T10:00:01Z] arxiv-watcher: starting\n`);

  const content = fs.readFileSync(threadFile, "utf8");
  assert(content.includes("research-lead"), "thread contains lead note");
  assert(content.includes("arxiv-watcher"), "thread contains member note");
  assert(content.split("\n").filter(Boolean).length === 2, "thread has two non-empty lines");

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
