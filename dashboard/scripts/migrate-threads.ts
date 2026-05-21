#!/usr/bin/env tsx
import fs from "node:fs";
import path from "node:path";
import { openDb } from "@/lib/db";
import { getIssue } from "@/lib/issues";

function repoRoot(): string {
  return process.env.AGENTIC_OS_REPO_ROOT ?? path.resolve(__dirname, "..", "..");
}

export function runThreadsMigration(): { moved: number; skipped: number } {
  const root = repoRoot();
  const legacyDir = path.join(root, "vault", "threads");
  if (!fs.existsSync(legacyDir)) return { moved: 0, skipped: 0 };

  openDb();

  let moved = 0;
  let skipped = 0;

  const files = fs.readdirSync(legacyDir).filter(f => f.endsWith(".md"));
  for (const file of files) {
    const base = path.basename(file, ".md");
    const issueId = parseInt(base, 10);
    if (Number.isNaN(issueId)) {
      skipped += 1;
      continue;
    }
    const issue = getIssue(issueId);
    if (!issue) {
      skipped += 1;
      continue;
    }
    const dest = path.join(root, "vault", "projects", issue.projectSlug, "threads", `${issueId}.md`);
    if (fs.existsSync(dest)) {
      skipped += 1;
      continue;
    }
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(path.join(legacyDir, file), dest);
    moved += 1;
  }
  return { moved, skipped };
}

if (require.main === module) {
  const r = runThreadsMigration();
  console.log(`Legacy threads moved: ${r.moved}, skipped: ${r.skipped}`);
}
