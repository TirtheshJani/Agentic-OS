// dashboard/lib/vault/noteWriter.ts
// All dashboard-originated vault writes go through here (spec 0015). Every
// write reindexes synchronously (the chokidar watcher debounce is 1.5s) and
// publishes vault.indexed; the later watcher rebuild is idempotent.
import fs from "node:fs";
import path from "node:path";
import { VAULT_DIR } from "@/lib/paths";
import { indexVault } from "@/lib/vault/indexer";
import { publish } from "@/lib/stream";
import { getDb } from "@/lib/db";

/** Folders the notetaker may create notes in (vault-relative). */
const ALLOWED_PREFIXES = ["raw", "wiki", "projects", "outputs", "learning", "research"];

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function kebab(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function assertInsideVault(abs: string): void {
  if (!path.resolve(abs).startsWith(path.resolve(VAULT_DIR) + path.sep)) {
    throw new Error("path outside vault");
  }
}

function assertAllowedFolder(folder: string): string {
  const clean = folder.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  if (!clean || clean.includes("..")) throw new Error(`invalid folder: ${folder}`);
  const top = clean.split("/")[0];
  if (!ALLOWED_PREFIXES.includes(top)) {
    throw new Error(`folder must be under one of: ${ALLOWED_PREFIXES.join(", ")}`);
  }
  return clean;
}

function reindexAndPublish(): void {
  const stats = indexVault();
  publish({ kind: "vault.indexed", ...stats });
}

function defaultFrontmatter(folder: string): string {
  if (folder.startsWith("raw/daily")) {
    return `---\ndate: ${todayIso()}\ndomain: []\nsource: dashboard\n---\n\n`;
  }
  if (folder.startsWith("wiki/")) {
    const domain = folder.slice("wiki/".length) || "general";
    return `---\ndomain: ${domain}\nsource: dashboard\ncreated: ${todayIso()}\nupdated: ${todayIso()}\ntags: []\n---\n\n`;
  }
  return `---\nsource: dashboard\ncreated: ${todayIso()}\n---\n\n`;
}

export interface CreatedNote {
  relPath: string;
}

export function createNote(opts: { folder: string; title: string; content: string }): CreatedNote {
  const folder = assertAllowedFolder(opts.folder);
  const base = kebab(opts.title);
  if (!base) throw new Error(`invalid note title: ${opts.title}`);

  const dir = path.join(VAULT_DIR, folder);
  const abs = path.join(dir, `${base}.md`);
  assertInsideVault(abs);
  if (fs.existsSync(abs)) throw new Error(`note already exists: ${folder}/${base}.md`);

  fs.mkdirSync(dir, { recursive: true });
  const hasFrontmatter = opts.content.trimStart().startsWith("---");
  const titleHeading = opts.content.match(/^#\s+/m) ? "" : `# ${opts.title}\n\n`;
  const body = hasFrontmatter ? opts.content : `${defaultFrontmatter(folder)}${titleHeading}${opts.content}`;
  fs.writeFileSync(abs, body);
  reindexAndPublish();
  return { relPath: `${folder}/${base}.md` };
}

export function updateNote(relPath: string, content: string): void {
  const abs = path.join(VAULT_DIR, relPath);
  assertInsideVault(abs);
  if (!relPath.endsWith(".md") || !fs.existsSync(abs)) throw new Error(`note not found: ${relPath}`);

  // Bump updated: in frontmatter when present.
  const next = content.replace(/^(---[\s\S]*?\nupdated:\s*)([^\n]*)/, `$1${todayIso()}`);
  fs.writeFileSync(abs, next);
  reindexAndPublish();
}

export function appendToDaily(text: string): CreatedNote {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("empty capture");
  const relPath = `raw/daily/${todayIso()}.md`;
  const abs = path.join(VAULT_DIR, relPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  if (!fs.existsSync(abs)) {
    fs.writeFileSync(abs, defaultFrontmatter("raw/daily"));
  }
  const hhmm = new Date().toTimeString().slice(0, 5);
  fs.appendFileSync(abs, `- ${hhmm} — ${trimmed}\n`);
  reindexAndPublish();
  return { relPath };
}

export interface NoteSuggestion {
  title: string;
  path: string;
  basename: string;
}

/** Prefix suggestions for [[wikilink]] autocomplete, from the notes index. */
export function suggestNotes(q: string, limit = 12): NoteSuggestion[] {
  const term = q.trim().toLowerCase();
  if (!term) return [];
  return getDb()
    .prepare(
      `SELECT title, path, basename FROM notes
       WHERE basename LIKE ? || '%' OR LOWER(title) LIKE ? || '%'
       ORDER BY basename LIMIT ?`
    )
    .all(term, term, limit) as NoteSuggestion[];
}
