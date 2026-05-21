// dashboard/lib/threads.ts
import fs from "node:fs";
import path from "node:path";
import { VAULT_PROJECTS_DIR } from "@/lib/paths";

export interface ThreadEntry {
  kind: "comment" | "event";
  author?: string;
  eventType?: string;
  body: string;
  timestamp: string; // ISO
}

export function threadFilePath(projectSlug: string, issueId: number, rootDir = VAULT_PROJECTS_DIR): string {
  return path.join(rootDir, projectSlug, "threads", `${issueId}.md`);
}

function nowIso(): string {
  return new Date().toISOString();
}

function ensureFile(fp: string): void {
  if (fs.existsSync(fp)) return;
  fs.mkdirSync(path.dirname(fp), { recursive: true });
  fs.writeFileSync(fp, "");
}

interface AppendCommentOpts {
  projectSlug: string;
  issueId: number;
  author: string;
  text: string;
}

export function appendComment(opts: AppendCommentOpts, rootDir = VAULT_PROJECTS_DIR): void {
  const fp = threadFilePath(opts.projectSlug, opts.issueId, rootDir);
  ensureFile(fp);
  const ts = nowIso();
  const section = `\n## ${ts} (comment from ${opts.author})\n\n${opts.text.trim()}\n`;
  fs.appendFileSync(fp, section);
}

interface AppendEventOpts {
  projectSlug: string;
  issueId: number;
  eventType: string;
  details: string;
}

export function appendEvent(opts: AppendEventOpts, rootDir = VAULT_PROJECTS_DIR): void {
  const fp = threadFilePath(opts.projectSlug, opts.issueId, rootDir);
  ensureFile(fp);
  const ts = nowIso();
  const section = `\n## ${ts} (event: ${opts.eventType})\n\n${opts.details.trim()}\n`;
  fs.appendFileSync(fp, section);
}

// Parser. Splits on lines starting with "## " followed by an ISO timestamp.
const HEADER_RE = /^##\s+(\d{4}-\d{2}-\d{2}T[\d:.Z+-]+)\s+\((comment from ([^)]+)|event: ([^)]+))\)\s*$/;

export function readThread(projectSlug: string, issueId: number, rootDir = VAULT_PROJECTS_DIR): ThreadEntry[] {
  const fp = threadFilePath(projectSlug, issueId, rootDir);
  if (!fs.existsSync(fp)) return [];
  const raw = fs.readFileSync(fp, "utf8");

  const lines = raw.split(/\r?\n/);
  const entries: ThreadEntry[] = [];
  let current: ThreadEntry | null = null;
  let bodyLines: string[] = [];

  for (const line of lines) {
    const match = line.match(HEADER_RE);
    if (match) {
      if (current) {
        current.body = bodyLines.join("\n").trim();
        entries.push(current);
      }
      const ts = match[1];
      if (match[3]) {
        current = { kind: "comment", author: match[3], body: "", timestamp: ts };
      } else {
        current = { kind: "event", eventType: match[4], body: "", timestamp: ts };
      }
      bodyLines = [];
    } else if (current) {
      bodyLines.push(line);
    }
  }
  if (current) {
    current.body = bodyLines.join("\n").trim();
    entries.push(current);
  }
  return entries;
}
