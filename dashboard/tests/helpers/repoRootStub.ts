// Import this module FIRST in a test file to point REPO_ROOT (and everything
// derived from it: vault, agents, state dir) at a throwaway temp directory.
// lib/paths.ts reads AGENTIC_OS_REPO_ROOT at import time, so this must
// execute before any "@/lib/*" import.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "agentic-repo-"));
process.env.AGENTIC_OS_REPO_ROOT = tmp;

export const TEST_REPO_ROOT = tmp;

export function cleanupTestRepoRoot(): void {
  fs.rmSync(tmp, { recursive: true, force: true });
}
