import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { vaultPath } from "@/lib/paths";

const SKIP_DIRS = new Set([".obsidian", ".git", "node_modules"]);
const MAX_FILE_BYTES = 256 * 1024;
const MAX_HITS = 20;
const SNIPPET_RADIUS = 60;

type Hit = { path: string; score: number; snippet: string };

function walk(dir: string, out: string[]): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    // Reject symlinks outright. A vault symlink pointing at /etc/passwd.md
    // (or C:\Windows\...) would otherwise leak its contents into a snippet.
    // We use lstat rather than stat so the link itself is inspected, not the
    // target. Dirent.isSymbolicLink() is reliable on Node 16+ but we lstat
    // anyway for the case where withFileTypes was satisfied by a synthetic
    // dirent (e.g. some network filesystems).
    let isSymlink = false;
    try {
      isSymlink = e.isSymbolicLink() || fs.lstatSync(full).isSymbolicLink();
    } catch {
      continue;
    }
    if (isSymlink) continue;
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name) || e.name.startsWith(".")) continue;
      walk(full, out);
    } else if (e.isFile() && e.name.endsWith(".md")) {
      out.push(full);
    }
  }
}

function scoreFile(file: string, body: string, qLower: string): Hit | null {
  const base = path.basename(file).toLowerCase();
  let score = 0;
  if (base.includes(qLower)) score += 5;
  const bodyLower = body.toLowerCase();
  const idx = bodyLower.indexOf(qLower);
  if (idx >= 0) {
    score += 1;
    let i = idx;
    while ((i = bodyLower.indexOf(qLower, i + 1)) >= 0) score += 0.25;
  }
  if (score === 0) return null;
  let snippet = "";
  if (idx >= 0) {
    const start = Math.max(0, idx - SNIPPET_RADIUS);
    const end = Math.min(body.length, idx + qLower.length + SNIPPET_RADIUS);
    snippet =
      (start > 0 ? "…" : "") +
      body.slice(start, end).replace(/\s+/g, " ").trim() +
      (end < body.length ? "…" : "");
  } else {
    snippet = body.slice(0, 120).replace(/\s+/g, " ").trim();
  }
  return {
    path: path.relative(vaultPath, file),
    score,
    snippet,
  };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  if (q.length < 2) {
    return NextResponse.json({ hits: [], reason: "query too short" });
  }
  const qLower = q.toLowerCase();
  const files: string[] = [];
  walk(vaultPath, files);
  const hits: Hit[] = [];
  for (const f of files) {
    let body: string;
    try {
      const stat = fs.statSync(f);
      if (stat.size > MAX_FILE_BYTES) continue;
      body = fs.readFileSync(f, "utf8");
    } catch {
      continue;
    }
    const hit = scoreFile(f, body, qLower);
    if (hit) hits.push(hit);
  }
  hits.sort((a, b) => b.score - a.score);
  return NextResponse.json({ hits: hits.slice(0, MAX_HITS) });
}
