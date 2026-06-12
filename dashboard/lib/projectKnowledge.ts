// dashboard/lib/projectKnowledge.ts
// Project knowledge (spec 0014): per-project knowledge docs, instructions, and
// outputs live as vault files under vault/projects/<slug>/. The vault indexer
// and the RAG layer (spec 0013) pick knowledge docs up automatically.
import fs from "node:fs";
import path from "node:path";
import { VAULT_PROJECTS_DIR } from "@/lib/paths";
import { slugRegex } from "@/lib/schemas";
import { indexVault } from "@/lib/vault/indexer";
import { publish } from "@/lib/stream";
import { getDb } from "@/lib/db";

const docNameRegex = /^[a-z0-9][a-z0-9-]*$/;

export interface KnowledgeDoc {
  name: string;
  relPath: string;
  size: number;
  mtime: number;
  chunkCount: number;
  embedded: number;
}

export interface OutputFile {
  name: string;
  relPath: string;
  mtime: number;
}

function projectDir(slug: string): string {
  if (!slugRegex.test(slug)) throw new Error(`invalid project slug: ${slug}`);
  return path.join(VAULT_PROJECTS_DIR, slug);
}

function knowledgeDir(slug: string): string {
  return path.join(projectDir(slug), "knowledge");
}

/** Vault-relative path prefix for a project's knowledge folder (retrieval scope). */
export function knowledgeScopePrefix(slug: string): string {
  return `projects/${slug}/knowledge/`;
}

export function listKnowledgeDocs(slug: string): KnowledgeDoc[] {
  const dir = knowledgeDir(slug);
  if (!fs.existsSync(dir)) return [];
  const db = getDb();
  const chunkStats = db.prepare(
    `SELECT COUNT(*) AS chunks,
            SUM(CASE WHEN e.content_hash IS NOT NULL THEN 1 ELSE 0 END) AS embedded
     FROM note_chunks c
     LEFT JOIN chunk_embeddings e ON e.content_hash = c.content_hash
     WHERE c.note_path = ?`
  );
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith(".md"))
    .map((e) => {
      const abs = path.join(dir, e.name);
      const stat = fs.statSync(abs);
      const relPath = `projects/${slug}/knowledge/${e.name}`;
      const stats = chunkStats.get(relPath) as { chunks: number; embedded: number | null };
      return {
        name: e.name,
        relPath,
        size: stat.size,
        mtime: stat.mtimeMs,
        chunkCount: stats.chunks,
        embedded: stats.embedded ?? 0,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Save a knowledge doc. Plain-text uploads are persisted as .md (the vault
 * indexer and watcher only see .md files). Returns the vault-relative path.
 */
export function saveKnowledgeDoc(slug: string, name: string, content: string): string {
  const base = name
    .replace(/\.(md|txt)$/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!base || !docNameRegex.test(base)) throw new Error(`invalid knowledge doc name: ${name}`);

  const dir = knowledgeDir(slug);
  fs.mkdirSync(dir, { recursive: true });
  const abs = path.join(dir, `${base}.md`);
  // Traversal guard (belt and braces; the name regex already prevents this).
  if (!path.resolve(abs).startsWith(path.resolve(dir) + path.sep)) {
    throw new Error("path outside knowledge folder");
  }

  const hasFrontmatter = content.trimStart().startsWith("---");
  const body = hasFrontmatter
    ? content
    : `---\nsource: upload\nadded: ${new Date().toISOString().slice(0, 10)}\n---\n\n${content}`;
  fs.writeFileSync(abs, body);

  // Index synchronously so the doc is queryable immediately (the chokidar
  // watcher debounce is 1.5s); the later watcher rebuild is idempotent.
  const stats = indexVault();
  publish({ kind: "vault.indexed", ...stats });
  return `projects/${slug}/knowledge/${base}.md`;
}

export function deleteKnowledgeDoc(slug: string, name: string): boolean {
  if (!/^[a-z0-9][a-z0-9-]*\.md$/.test(name)) throw new Error(`invalid knowledge doc name: ${name}`);
  const abs = path.join(knowledgeDir(slug), name);
  if (!fs.existsSync(abs)) return false;
  fs.rmSync(abs);
  const stats = indexVault();
  publish({ kind: "vault.indexed", ...stats });
  return true;
}

export function readInstructions(slug: string): string {
  const abs = path.join(projectDir(slug), "INSTRUCTIONS.md");
  if (!fs.existsSync(abs)) return "";
  return fs.readFileSync(abs, "utf8");
}

export function writeInstructions(slug: string, content: string): void {
  const dir = projectDir(slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "INSTRUCTIONS.md"), content);
  const stats = indexVault();
  publish({ kind: "vault.indexed", ...stats });
}

export function listOutputs(slug: string): OutputFile[] {
  const dir = path.join(projectDir(slug), "outputs");
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => ({
      name: e.name,
      relPath: `projects/${slug}/outputs/${e.name}`,
      mtime: fs.statSync(path.join(dir, e.name)).mtimeMs,
    }))
    .sort((a, b) => b.mtime - a.mtime);
}
