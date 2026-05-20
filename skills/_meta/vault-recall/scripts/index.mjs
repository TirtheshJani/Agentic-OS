#!/usr/bin/env node
// Index markdown files into the vault-recall semantic store.
// Default mode is incremental: only files whose mtime moved past
// vault_chunks_meta.file_mtime get re-embedded.
//
// Usage:
//   node scripts/index.mjs                # incremental, all roots
//   node scripts/index.mjs --full         # drop existing rows, rebuild
//   node scripts/index.mjs --paths a,b    # restrict to specific roots
//   node scripts/index.mjs --dry-run      # list what would change

import fs from "node:fs";
import path from "node:path";
import {
  INDEX_ROOTS,
  REPO_ROOT,
  chunkMarkdown,
  embedText,
  getDb,
  relPath,
  vectorToBuffer,
  walkMarkdown,
} from "./_lib.mjs";

function parseArgs(argv) {
  const args = { full: false, dryRun: false, paths: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--full") args.full = true;
    else if (a === "--dry-run") args.dryRun = true;
    else if (a === "--paths") {
      args.paths = argv[++i]?.split(",").map((s) => s.trim()).filter(Boolean);
    }
  }
  return args;
}

function filterRoots(paths) {
  if (!paths) return INDEX_ROOTS;
  return INDEX_ROOTS.filter((r) => {
    const rel = path.relative(REPO_ROOT, r.root);
    return paths.some((p) => rel === p || rel.startsWith(`${p}${path.sep}`) || r.root.includes(p));
  });
}

async function main() {
  const args = parseArgs(process.argv);
  const roots = filterRoots(args.paths);
  const db = getDb();

  if (args.full && !args.dryRun) {
    console.log("[vault-recall] --full: clearing existing index");
    db.exec("DELETE FROM vault_chunks_meta; DELETE FROM vault_chunks_vec; DELETE FROM vault_index_state;");
  }

  // vault_index_state has one row per seen file (including empty-after-chunking
  // files), so incremental runs don't keep retrying frontmatter-only stubs.
  const lastIndexed = new Map();
  for (const row of db.prepare("SELECT path, file_mtime FROM vault_index_state").iterate()) {
    lastIndexed.set(row.path, row.file_mtime);
  }

  const work = [];
  for (const r of roots) {
    const files = walkMarkdown(r.root);
    for (const abs of files) {
      const rel = relPath(abs);
      const stat = fs.statSync(abs);
      const mtime = Math.floor(stat.mtimeMs);
      const known = lastIndexed.get(rel);
      if (!args.full && known !== undefined && known >= mtime) continue;
      work.push({ abs, rel, mtime, kind: r.kind });
    }
  }

  if (work.length === 0) {
    console.log("[vault-recall] nothing to index (everything up to date)");
    return;
  }

  console.log(`[vault-recall] ${work.length} file(s) to (re)index`);
  if (args.dryRun) {
    for (const w of work) console.log(`  + ${w.rel}`);
    return;
  }

  // Statements reused across the loop.
  const deleteMeta = db.prepare("DELETE FROM vault_chunks_meta WHERE path = ?");
  const deleteVec = db.prepare(
    "DELETE FROM vault_chunks_vec WHERE rowid IN (SELECT rowid FROM vault_chunks_meta WHERE path = ?)"
  );
  const insertMeta = db.prepare(
    `INSERT INTO vault_chunks_meta (path, chunk_index, chunk_text, file_mtime, indexed_at, kind)
     VALUES (?, ?, ?, ?, ?, ?)`
  );
  const insertVec = db.prepare(
    "INSERT INTO vault_chunks_vec(rowid, embedding) VALUES (?, ?)"
  );
  const upsertState = db.prepare(
    `INSERT INTO vault_index_state (path, file_mtime, indexed_at, chunk_count)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(path) DO UPDATE SET
       file_mtime = excluded.file_mtime,
       indexed_at = excluded.indexed_at,
       chunk_count = excluded.chunk_count`
  );

  let totalChunks = 0;
  for (const w of work) {
    let raw;
    try {
      raw = fs.readFileSync(w.abs, "utf8");
    } catch (err) {
      console.error(`  ! skip ${w.rel}: ${err.message}`);
      continue;
    }
    const chunks = chunkMarkdown(raw);
    const now = Date.now();

    // Always replace stale rows for this path.
    deleteVec.run(w.rel);
    deleteMeta.run(w.rel);

    if (chunks.length === 0) {
      console.log(`  - ${w.rel} (empty after chunking)`);
      upsertState.run(w.rel, w.mtime, now, 0);
      continue;
    }

    for (let i = 0; i < chunks.length; i++) {
      const text = chunks[i];
      const vec = await embedText(text);
      const info = insertMeta.run(w.rel, i, text, w.mtime, now, w.kind);
      insertVec.run(BigInt(info.lastInsertRowid), vectorToBuffer(vec));
      totalChunks++;
    }
    upsertState.run(w.rel, w.mtime, now, chunks.length);
    console.log(`  + ${w.rel} (${chunks.length} chunk${chunks.length === 1 ? "" : "s"})`);
  }

  console.log(`[vault-recall] indexed ${totalChunks} chunk(s) across ${work.length} file(s)`);
}

main().catch((err) => {
  console.error("[vault-recall] indexer failed:", err);
  process.exit(1);
});
