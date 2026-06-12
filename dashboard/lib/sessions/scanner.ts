// dashboard/lib/sessions/scanner.ts
// Incremental CLI-session scan (spec 0018): summaries into the sessions table,
// keyed by file path with (mtime, size) change detection. Message bodies are
// never stored; the detail API re-reads the file.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { getDb } from "@/lib/db";
import { parseClaudeSession } from "@/lib/sessions/parseClaude";
import { parseGeminiSession } from "@/lib/sessions/parseGemini";
import { estimateCost } from "@/lib/usage/pricing";
import { listProjects } from "@/lib/projects";

export interface ScanStats {
  scanned: number;
  updated: number;
  removed: number;
}

export function defaultClaudeRoot(): string {
  return path.join(os.homedir(), ".claude", "projects");
}

export function defaultGeminiRoot(): string {
  return path.join(os.homedir(), ".gemini", "tmp");
}

function listClaudeFiles(root: string): string[] {
  if (!fs.existsSync(root)) return [];
  const out: string[] = [];
  for (const dir of fs.readdirSync(root, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    const abs = path.join(root, dir.name);
    for (const f of fs.readdirSync(abs, { withFileTypes: true })) {
      if (f.isFile() && f.name.endsWith(".jsonl")) out.push(path.join(abs, f.name));
    }
  }
  return out;
}

function listGeminiFiles(root: string): string[] {
  if (!fs.existsSync(root)) return [];
  const out: string[] = [];
  for (const dir of fs.readdirSync(root, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    const chats = path.join(root, dir.name, "chats");
    if (!fs.existsSync(chats)) continue;
    for (const f of fs.readdirSync(chats, { withFileTypes: true })) {
      if (f.isFile() && f.name.endsWith(".jsonl")) out.push(path.join(chats, f.name));
    }
  }
  return out;
}

function matchProjectSlug(cwd: string | null, projects: Array<{ slug: string; path: string }>): string | null {
  if (!cwd) return null;
  const lower = cwd.toLowerCase();
  for (const p of projects) {
    if (lower.startsWith(p.path.toLowerCase())) return p.slug;
    if (lower.includes(`${path.sep}${p.slug}${path.sep}`) || lower.endsWith(`${path.sep}${p.slug}`)) return p.slug;
  }
  return null;
}

export function scanSessions(opts: { claudeRoot?: string; geminiRoot?: string } = {}): ScanStats {
  const db = getDb();
  const claudeRoot = opts.claudeRoot ?? defaultClaudeRoot();
  const geminiRoot = opts.geminiRoot ?? defaultGeminiRoot();

  let projects: Array<{ slug: string; path: string }> = [];
  try {
    projects = listProjects().map((p) => ({ slug: p.slug, path: p.path }));
  } catch {
    // project registry unavailable; sessions stay unmatched
  }

  const known = new Map<string, { mtime: number; size: number }>();
  for (const row of db.prepare("SELECT file_path, file_mtime, file_size FROM sessions").all() as Array<{
    file_path: string;
    file_mtime: number;
    file_size: number;
  }>) {
    known.set(row.file_path, { mtime: row.file_mtime, size: row.file_size });
  }

  const upsert = db.prepare(`
    INSERT INTO sessions (provider, session_id, file_path, project_dir, project_slug, run_id,
      started_at, ended_at, turns_user, turns_assistant, tool_calls,
      tokens_in, tokens_out, tokens_cache_write, tokens_cache_read, models, cost_estimate,
      file_mtime, file_size, indexed_at)
    VALUES (@provider, @sessionId, @filePath, @projectDir, @projectSlug, @runId,
      @startedAt, @endedAt, @turnsUser, @turnsAssistant, @toolCalls,
      @tokensIn, @tokensOut, @tokensCacheWrite, @tokensCacheRead, @models, @costEstimate,
      @fileMtime, @fileSize, @indexedAt)
    ON CONFLICT(file_path) DO UPDATE SET
      session_id=@sessionId, project_dir=@projectDir, project_slug=@projectSlug, run_id=@runId,
      started_at=@startedAt, ended_at=@endedAt, turns_user=@turnsUser, turns_assistant=@turnsAssistant,
      tool_calls=@toolCalls, tokens_in=@tokensIn, tokens_out=@tokensOut,
      tokens_cache_write=@tokensCacheWrite, tokens_cache_read=@tokensCacheRead,
      models=@models, cost_estimate=@costEstimate,
      file_mtime=@fileMtime, file_size=@fileSize, indexed_at=@indexedAt
  `);
  const findRun = db.prepare("SELECT id FROM runs WHERE pty_session_id = ? ORDER BY id DESC LIMIT 1");

  let scanned = 0;
  let updated = 0;
  const seen = new Set<string>();

  const processFile = (filePath: string, provider: "claude-code" | "gemini-cli") => {
    scanned++;
    seen.add(filePath);
    let stat: fs.Stats;
    try {
      stat = fs.statSync(filePath);
    } catch {
      return;
    }
    const prev = known.get(filePath);
    if (prev && prev.mtime === Math.round(stat.mtimeMs) && prev.size === stat.size) return;

    let text: string;
    try {
      text = fs.readFileSync(filePath, "utf8");
    } catch {
      return;
    }
    const parsed = provider === "claude-code" ? parseClaudeSession(text) : parseGeminiSession(text);
    const s = parsed.summary;
    const run = s.sessionId ? (findRun.get(s.sessionId) as { id: number } | undefined) : undefined;

    upsert.run({
      provider,
      sessionId: s.sessionId ?? path.basename(filePath, ".jsonl"),
      filePath,
      projectDir: s.cwd ?? path.basename(path.dirname(provider === "claude-code" ? filePath : path.dirname(filePath))),
      projectSlug: matchProjectSlug(s.cwd, projects),
      runId: run?.id ?? null,
      startedAt: s.startedAt,
      endedAt: s.endedAt,
      turnsUser: s.turnsUser,
      turnsAssistant: s.turnsAssistant,
      toolCalls: s.toolCalls,
      tokensIn: s.tokens?.in ?? null,
      tokensOut: s.tokens?.out ?? null,
      tokensCacheWrite: s.tokens?.cacheWrite ?? null,
      tokensCacheRead: s.tokens?.cacheRead ?? null,
      models: JSON.stringify(s.models),
      costEstimate: estimateCost(s.models),
      fileMtime: Math.round(stat.mtimeMs),
      fileSize: stat.size,
      indexedAt: Date.now(),
    });
    updated++;
  };

  for (const f of listClaudeFiles(claudeRoot)) processFile(f, "claude-code");
  for (const f of listGeminiFiles(geminiRoot)) processFile(f, "gemini-cli");

  // Prune rows whose files vanished.
  let removed = 0;
  const del = db.prepare("DELETE FROM sessions WHERE file_path = ?");
  for (const filePath of known.keys()) {
    if (!seen.has(filePath)) {
      del.run(filePath);
      removed++;
    }
  }

  return { scanned, updated, removed };
}
