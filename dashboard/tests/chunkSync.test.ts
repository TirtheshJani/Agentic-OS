import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { openDb, getDb, closeDb } from "@/lib/db";
import { indexVault } from "@/lib/vault/indexer";
import { pruneEmbeddingCache } from "@/lib/rag/chunkSync";

let tmp: string;
let vaultDir: string;

function write(rel: string, content: string) {
  const fp = path.join(vaultDir, rel);
  fs.mkdirSync(path.dirname(fp), { recursive: true });
  fs.writeFileSync(fp, content);
}

function chunkRows(): Array<{ note_path: string; chunk_index: number; content_hash: string }> {
  return getDb()
    .prepare("SELECT note_path, chunk_index, content_hash FROM note_chunks ORDER BY note_path, chunk_index")
    .all() as Array<{ note_path: string; chunk_index: number; content_hash: string }>;
}

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "agentic-rag-"));
  vaultDir = path.join(tmp, "vault");
  fs.mkdirSync(vaultDir);
  openDb(path.join(tmp, "state.db"));
  write("wiki/alpha.md", `# Alpha\n\nAlpha body content. ${"a".repeat(350)}\n`);
  write("wiki/beta.md", `# Beta\n\nBeta body content. ${"b".repeat(350)}\n`);
});

afterEach(() => {
  closeDb();
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe("syncNoteChunks via indexVault", () => {
  it("creates chunks for every note", () => {
    indexVault(vaultDir);
    const rows = chunkRows();
    expect(rows.length).toBeGreaterThanOrEqual(2);
    expect(rows.some((r) => r.note_path === "wiki/alpha.md")).toBe(true);
  });

  it("keeps unchanged chunk rows and hashes across full rebuilds", () => {
    indexVault(vaultDir);
    const before = chunkRows();
    indexVault(vaultDir); // full notes rebuild; chunks must be untouched
    expect(chunkRows()).toEqual(before);
  });

  it("re-chunks only edited notes and removes deleted notes' chunks", () => {
    indexVault(vaultDir);
    const alphaBefore = chunkRows().filter((r) => r.note_path === "wiki/alpha.md");

    write("wiki/beta.md", `# Beta\n\nCompletely new beta content. ${"c".repeat(350)}\n`);
    indexVault(vaultDir);

    const after = chunkRows();
    const alphaAfter = after.filter((r) => r.note_path === "wiki/alpha.md");
    expect(alphaAfter).toEqual(alphaBefore); // identical content -> identical rows
    const betaAfter = after.filter((r) => r.note_path === "wiki/beta.md");
    expect(betaAfter.length).toBeGreaterThan(0);

    fs.rmSync(path.join(vaultDir, "wiki/beta.md"));
    indexVault(vaultDir);
    expect(chunkRows().some((r) => r.note_path === "wiki/beta.md")).toBe(false);
  });

  it("never touches chunk_embeddings on rebuild; prune drops only orphans", () => {
    indexVault(vaultDir);
    const hash = chunkRows()[0].content_hash;
    getDb()
      .prepare("INSERT INTO chunk_embeddings (content_hash, model, dims, vector, created_at) VALUES (?, ?, ?, ?, ?)")
      .run(hash, "test-model", 4, Buffer.from(new Float32Array([1, 0, 0, 0]).buffer), Date.now());
    getDb()
      .prepare("INSERT INTO chunk_embeddings (content_hash, model, dims, vector, created_at) VALUES (?, ?, ?, ?, ?)")
      .run("orphan-hash", "test-model", 4, Buffer.from(new Float32Array([0, 1, 0, 0]).buffer), Date.now());

    indexVault(vaultDir); // full rebuild
    const n = (getDb().prepare("SELECT COUNT(*) AS n FROM chunk_embeddings").get() as { n: number }).n;
    expect(n).toBe(2);

    const pruned = pruneEmbeddingCache();
    expect(pruned).toBe(1);
    const left = getDb().prepare("SELECT content_hash FROM chunk_embeddings").all() as Array<{ content_hash: string }>;
    expect(left.map((r) => r.content_hash)).toEqual([hash]);
  });
});
