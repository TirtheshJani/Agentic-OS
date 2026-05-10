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
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name) || e.name.startsWith(".")) continue;
      walk(path.join(dir, e.name), out);
    } else if (e.isFile() && e.name.endsWith(".md")) {
      out.push(path.join(dir, e.name));
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
