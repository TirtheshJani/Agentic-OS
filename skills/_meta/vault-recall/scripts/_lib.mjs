// Shared helpers for the vault-recall skill: paths, db, embedder, chunker.
// All scripts in this folder import from here.

import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import * as sqliteVec from "sqlite-vec";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// scripts/ -> vault-recall/ -> _meta/ -> skills/ -> repo root
export const REPO_ROOT = path.resolve(__dirname, "..", "..", "..", "..");
export const DB_PATH = path.join(REPO_ROOT, ".agentic-os", "state.db");
export const VAULT_ROOT = path.join(REPO_ROOT, "vault");

// Roots indexed. Order is intentional: high-signal first, daily noise last.
export const INDEX_ROOTS = [
  { root: path.join(VAULT_ROOT, "wiki"), kind: "wiki" },
  { root: path.join(VAULT_ROOT, "projects"), kind: "project" },
  { root: path.join(VAULT_ROOT, "raw", "daily"), kind: "daily" },
  // Claude auto-memory directories live outside the repo.
  { root: path.join(os.homedir(), ".claude", "projects"), kind: "claude-memory" },
];

// Embedding model. Float32, 384 dims, mean pooled + L2 normalized.
const MODEL_ID = "Xenova/all-MiniLM-L6-v2";
const EMBED_DIM = 384;

let _embedder = null;
let _dbInstance = null;

export function getDb() {
  if (_dbInstance) return _dbInstance;
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  // Load sqlite-vec extension.
  sqliteVec.load(db);
  // Idempotent schema. The vec0 virtual table needs the extension loaded first.
  db.exec(`
    CREATE TABLE IF NOT EXISTS vault_chunks_meta (
      rowid INTEGER PRIMARY KEY AUTOINCREMENT,
      path TEXT NOT NULL,
      chunk_index INTEGER NOT NULL,
      chunk_text TEXT NOT NULL,
      file_mtime INTEGER NOT NULL,
      indexed_at INTEGER NOT NULL,
      kind TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_vault_chunks_path ON vault_chunks_meta(path);

    CREATE TABLE IF NOT EXISTS vault_index_state (
      path TEXT PRIMARY KEY,
      file_mtime INTEGER NOT NULL,
      indexed_at INTEGER NOT NULL,
      chunk_count INTEGER NOT NULL
    );
  `);
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS vault_chunks_vec
    USING vec0(embedding float[${EMBED_DIM}]);
  `);
  _dbInstance = db;
  return db;
}

export async function getEmbedder() {
  if (_embedder) return _embedder;
  // Lazy-import so a CLI like --help does not pay the ONNX cost.
  const { pipeline, env } = await import("@huggingface/transformers");
  // Cache model under repo so it survives across user home reshuffles.
  env.cacheDir = path.join(REPO_ROOT, ".agentic-os", "models");
  fs.mkdirSync(env.cacheDir, { recursive: true });
  _embedder = await pipeline("feature-extraction", MODEL_ID, {
    dtype: "q8",
  });
  return _embedder;
}

export async function embedText(text) {
  const embedder = await getEmbedder();
  const out = await embedder(text, { pooling: "mean", normalize: true });
  return Float32Array.from(out.data);
}

export function vectorToBuffer(vec) {
  return Buffer.from(vec.buffer, vec.byteOffset, vec.byteLength);
}

// ---- chunking ----

// Strip a leading YAML frontmatter block. Keeps the rest verbatim.
function stripFrontmatter(text) {
  if (!text.startsWith("---")) return text;
  const end = text.indexOf("\n---", 3);
  if (end < 0) return text;
  return text.slice(end + 4).replace(/^\n/, "");
}

// Markdown-aware chunker.
//   1. split on H2/H3 headers (keep header in the chunk)
//   2. if a section is too long, sub-split by paragraph
//   3. drop chunks below MIN_CHARS
export function chunkMarkdown(raw, opts = {}) {
  const MAX = opts.maxChars ?? 1500;
  const MIN = opts.minChars ?? 80;
  const body = stripFrontmatter(raw).trim();
  if (!body) return [];

  // Split on ##/### headings; keep them with the following content.
  const sections = body.split(/\n(?=##? )/g);

  const chunks = [];
  for (const section of sections) {
    if (section.length <= MAX) {
      if (section.trim().length >= MIN) chunks.push(section.trim());
      continue;
    }
    // Section too long. Pack paragraphs greedily until we exceed MAX.
    const paras = section.split(/\n\n+/);
    let buf = "";
    for (const p of paras) {
      if (!p.trim()) continue;
      if (buf.length + p.length + 2 > MAX && buf.length >= MIN) {
        chunks.push(buf.trim());
        buf = p;
      } else {
        buf = buf ? `${buf}\n\n${p}` : p;
      }
    }
    if (buf.trim().length >= MIN) chunks.push(buf.trim());
  }
  return chunks;
}

// ---- file discovery ----

export function walkMarkdown(root) {
  const out = [];
  if (!fs.existsSync(root)) return out;
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkMarkdown(full));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      out.push(full);
    }
  }
  return out;
}

export function relPath(absPath) {
  // Repo-relative when inside the repo; home-relative ("~/foo") when outside
  // (e.g. Claude auto-memory under ~/.claude/projects). Forward slashes so
  // DB rows match across Win/Mac.
  const repoRel = path.relative(REPO_ROOT, absPath);
  if (!repoRel.startsWith("..")) return repoRel.split(path.sep).join("/");
  const homeRel = path.relative(os.homedir(), absPath);
  if (!homeRel.startsWith("..")) {
    return `~/${homeRel.split(path.sep).join("/")}`;
  }
  return absPath.split(path.sep).join("/");
}
