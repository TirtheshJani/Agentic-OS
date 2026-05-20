#!/usr/bin/env node
// Top-k semantic search over the vault-recall index.
// Usage:
//   node scripts/query.mjs "your query" [--k 8] [--kind wiki,project]
//   node scripts/query.mjs --stats         # show index stats and exit
//
// Output is JSON on stdout. Stderr is human progress and errors so callers
// can pipe stdout into jq.

import { embedText, getDb, vectorToBuffer } from "./_lib.mjs";

function parseArgs(argv) {
  const args = { query: "", k: 8, kinds: null, stats: false };
  const positional = [];
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--k") args.k = parseInt(argv[++i], 10);
    else if (a === "--kind") args.kinds = argv[++i].split(",").map((s) => s.trim());
    else if (a === "--stats") args.stats = true;
    else positional.push(a);
  }
  args.query = positional.join(" ").trim();
  return args;
}

function showStats(db) {
  const totalChunks = db.prepare("SELECT COUNT(*) AS n FROM vault_chunks_meta").get().n;
  const totalFiles = db
    .prepare("SELECT COUNT(DISTINCT path) AS n FROM vault_chunks_meta")
    .get().n;
  const byKind = db
    .prepare(
      "SELECT kind, COUNT(*) AS chunks, COUNT(DISTINCT path) AS files FROM vault_chunks_meta GROUP BY kind ORDER BY chunks DESC"
    )
    .all();
  const newest = db
    .prepare("SELECT MAX(indexed_at) AS t FROM vault_chunks_meta")
    .get().t;
  console.log(JSON.stringify({
    total_chunks: totalChunks,
    total_files: totalFiles,
    by_kind: byKind,
    last_indexed_at: newest ? new Date(newest).toISOString() : null,
  }, null, 2));
}

async function main() {
  const args = parseArgs(process.argv);
  const db = getDb();

  if (args.stats) {
    showStats(db);
    return;
  }

  if (!args.query) {
    console.error("usage: query.mjs \"your query\" [--k 8] [--kind wiki,project]");
    process.exit(2);
  }

  // Empty index: warn loudly so Claude knows to run --full first.
  const have = db.prepare("SELECT COUNT(*) AS n FROM vault_chunks_meta").get().n;
  if (have === 0) {
    console.error("[vault-recall] index is empty; run: node scripts/index.mjs --full");
    console.log(JSON.stringify({ query: args.query, results: [], empty: true }));
    return;
  }

  const vec = await embedText(args.query);
  const buf = vectorToBuffer(vec);

  // Pull more than k from the vec table so we can post-filter by kind.
  const k = Math.max(1, args.k);
  const overFetch = args.kinds ? k * 4 : k;
  const rows = db
    .prepare(
      `SELECT v.rowid AS rowid, v.distance AS distance,
              m.path AS path, m.chunk_index AS chunk_index,
              m.chunk_text AS chunk_text, m.kind AS kind
         FROM vault_chunks_vec v
         JOIN vault_chunks_meta m ON m.rowid = v.rowid
        WHERE v.embedding MATCH ? AND k = ?
        ORDER BY v.distance`
    )
    .all(buf, overFetch);

  const filtered = args.kinds
    ? rows.filter((r) => args.kinds.includes(r.kind))
    : rows;
  const top = filtered.slice(0, k).map((r) => ({
    path: r.path,
    kind: r.kind,
    chunk_index: r.chunk_index,
    distance: Number(r.distance.toFixed(4)),
    text: r.chunk_text.length > 600 ? r.chunk_text.slice(0, 600) + "…" : r.chunk_text,
  }));

  console.log(JSON.stringify({ query: args.query, results: top }, null, 2));
}

main().catch((err) => {
  console.error("[vault-recall] query failed:", err);
  process.exit(1);
});
