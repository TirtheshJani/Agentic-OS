import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import chokidar from "chokidar";
import { VAULT_DIR } from "@/lib/paths";
import { getDb } from "@/lib/db";
import { publish } from "@/lib/stream";

const IGNORED_DIRS = new Set([".obsidian", ".trash", ".git", "node_modules"]);
const WIKILINK_RE = /\[\[([^\]|#\n]+)/g;
const INLINE_TAG_RE = /(^|[\s(])#([A-Za-z][\w/-]*)/g;
const DEBOUNCE_MS = 1500;

export interface IndexStats {
  notes: number;
  links: number;
}

interface ParsedNote {
  relPath: string;
  basename: string;
  title: string;
  folder: string;
  tags: string[];
  links: string[];
  body: string;
  mtime: number;
}

function walkMd(dir: string, acc: string[] = []): string[] {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const e of entries) {
    if (e.isDirectory()) {
      if (!IGNORED_DIRS.has(e.name)) walkMd(path.join(dir, e.name), acc);
    } else if (e.isFile() && e.name.endsWith(".md")) {
      acc.push(path.join(dir, e.name));
    }
  }
  return acc;
}

/** Resolution key for a wikilink target: last segment, no extension, lowercase. */
function linkKey(raw: string): string {
  const last = raw.trim().split("/").pop() ?? raw.trim();
  return last.replace(/\.md$/i, "").toLowerCase();
}

function parseNote(absPath: string, rootDir: string): ParsedNote | null {
  let raw: string;
  let stat: fs.Stats;
  try {
    raw = fs.readFileSync(absPath, "utf8");
    stat = fs.statSync(absPath);
  } catch {
    return null;
  }
  let fm: Record<string, unknown> = {};
  let body = raw;
  try {
    const parsed = matter(raw);
    fm = parsed.data as Record<string, unknown>;
    body = parsed.content;
  } catch {
    // Bad frontmatter: index the whole file as body.
  }

  const relPath = path.relative(rootDir, absPath).split(path.sep).join("/");
  const basename = path.basename(relPath, ".md");
  const h1 = body.match(/^#\s+(.+)$/m)?.[1]?.trim();
  const title = (typeof fm.title === "string" && fm.title) || h1 || basename;
  const folder = relPath.includes("/") ? relPath.split("/")[0] : "(root)";

  const tags = new Set<string>();
  const fmTags = fm.tags;
  if (Array.isArray(fmTags)) for (const t of fmTags) tags.add(String(t).replace(/^#/, ""));
  else if (typeof fmTags === "string") for (const t of fmTags.split(/[,\s]+/)) if (t) tags.add(t.replace(/^#/, ""));
  for (const m of body.matchAll(INLINE_TAG_RE)) tags.add(m[2]);

  const links: string[] = [];
  for (const m of body.matchAll(WIKILINK_RE)) {
    const target = m[1].trim();
    if (target) links.push(target);
  }

  return { relPath, basename, title, folder, tags: [...tags], links, body, mtime: stat.mtimeMs };
}

/**
 * Full reindex of the vault into SQLite (notes, note_links, notes_fts).
 * The vault is a few hundred files; a transactional full rebuild stays well
 * under 100ms, so there is no incremental path to get wrong.
 */
export function indexVault(rootDir: string = VAULT_DIR): IndexStats {
  const db = getDb();
  const parsed = walkMd(rootDir)
    .map((f) => parseNote(f, rootDir))
    .filter((p): p is ParsedNote => p !== null);

  let linkCount = 0;
  const run = db.transaction(() => {
    db.prepare("DELETE FROM note_links").run();
    db.prepare("DELETE FROM notes").run();
    db.exec("DELETE FROM notes_fts");

    const insertNote = db.prepare(
      "INSERT INTO notes (path, basename, title, folder, tags, mtime, indexed_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    );
    const insertLink = db.prepare(
      "INSERT INTO note_links (source_id, target_id, target_raw) VALUES (?, ?, ?)"
    );
    const insertFts = db.prepare("INSERT INTO notes_fts (title, body, path) VALUES (?, ?, ?)");

    const byKey = new Map<string, number>();
    const ids = new Map<string, number>();
    const now = Date.now();

    for (const note of parsed) {
      const info = insertNote.run(
        note.relPath,
        note.basename.toLowerCase(),
        note.title,
        note.folder,
        JSON.stringify(note.tags),
        Math.round(note.mtime),
        now
      );
      const id = Number(info.lastInsertRowid);
      ids.set(note.relPath, id);
      // First writer wins on duplicate basenames/titles; deterministic enough.
      if (!byKey.has(note.basename.toLowerCase())) byKey.set(note.basename.toLowerCase(), id);
      if (!byKey.has(note.title.toLowerCase())) byKey.set(note.title.toLowerCase(), id);
      insertFts.run(note.title, note.body, note.relPath);
    }

    for (const note of parsed) {
      const sourceId = ids.get(note.relPath)!;
      for (const target of note.links) {
        const targetId = byKey.get(linkKey(target)) ?? null;
        insertLink.run(sourceId, targetId, target);
        linkCount++;
      }
    }
  });
  run();

  return { notes: parsed.length, links: linkCount };
}

interface WatcherState {
  stop: () => void;
}

const globalKey = Symbol.for("agentic-os.vaultWatcher");
const g = globalThis as unknown as Record<symbol, WatcherState | undefined>;

/** Debounced reindex on any vault markdown change. Singleton. */
export function startVaultWatcher(rootDir: string = VAULT_DIR): () => void {
  if (g[globalKey]) return g[globalKey]!.stop;

  let timer: NodeJS.Timeout | null = null;
  const watcher = chokidar.watch(rootDir, {
    ignoreInitial: true,
    ignored: (p: string) =>
      p.split(path.sep).some((seg) => IGNORED_DIRS.has(seg)),
  });

  const onChange = (p: string) => {
    if (!p.endsWith(".md")) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      try {
        const stats = indexVault(rootDir);
        publish({ kind: "vault.indexed", ...stats });
        console.log(`[vault] reindexed: ${stats.notes} notes, ${stats.links} links`);
      } catch (err) {
        console.error("[vault] reindex failed:", err);
      }
    }, DEBOUNCE_MS);
  };

  watcher.on("add", onChange).on("change", onChange).on("unlink", onChange);

  const stop = () => {
    if (timer) clearTimeout(timer);
    void watcher.close();
    g[globalKey] = undefined;
  };
  g[globalKey] = { stop };
  console.log("[vault] watcher started");
  return stop;
}
