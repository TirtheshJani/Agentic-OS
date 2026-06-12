import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { openDb, getDb, closeDb } from "@/lib/db";
import { indexVault } from "@/lib/vault/indexer";

let tmp: string;
let vaultDir: string;

function write(rel: string, content: string) {
  const fp = path.join(vaultDir, rel);
  fs.mkdirSync(path.dirname(fp), { recursive: true });
  fs.writeFileSync(fp, content);
}

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "agentic-vault-"));
  vaultDir = path.join(tmp, "vault");
  fs.mkdirSync(vaultDir);
  openDb(path.join(tmp, "state.db"));

  write("wiki/fhir-rag.md", `---\ntitle: FHIR RAG\ntags: [healthcare, rag]\n---\n\nLinks to [[daily-note]] and [[Missing Note]].\nInline #pipeline tag.\n`);
  write("raw/daily/daily-note.md", `# Daily Note\n\nMentions [[FHIR RAG]] by title.\n`);
  write(".obsidian/ignored.md", `should never be indexed`);
});

afterEach(() => {
  closeDb();
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe("indexVault", () => {
  it("indexes notes with folder, title, and merged tags", () => {
    const stats = indexVault(vaultDir);
    expect(stats.notes).toBe(2);

    const rows = getDb().prepare("SELECT path, title, folder, tags FROM notes ORDER BY path").all() as Array<{
      path: string; title: string; folder: string; tags: string;
    }>;
    expect(rows.map((r) => r.path)).toEqual(["raw/daily/daily-note.md", "wiki/fhir-rag.md"]);
    const fhir = rows[1];
    expect(fhir.title).toBe("FHIR RAG");
    expect(fhir.folder).toBe("wiki");
    expect(JSON.parse(fhir.tags)).toEqual(expect.arrayContaining(["healthcare", "rag", "pipeline"]));
    // .obsidian content is never indexed
    expect(rows.some((r) => r.path.includes(".obsidian"))).toBe(false);
  });

  it("resolves wikilinks by basename and by title, keeps unresolved raw", () => {
    indexVault(vaultDir);
    const links = getDb()
      .prepare(
        `SELECT s.path AS source, t.path AS target, l.target_raw
         FROM note_links l
         JOIN notes s ON s.id = l.source_id
         LEFT JOIN notes t ON t.id = l.target_id
         ORDER BY l.target_raw`
      )
      .all() as Array<{ source: string; target: string | null; target_raw: string }>;

    const byRaw = Object.fromEntries(links.map((l) => [l.target_raw, l]));
    // [[daily-note]] resolves by basename
    expect(byRaw["daily-note"].target).toBe("raw/daily/daily-note.md");
    // [[FHIR RAG]] resolves by title
    expect(byRaw["FHIR RAG"].target).toBe("wiki/fhir-rag.md");
    // [[Missing Note]] stays unresolved but keeps its raw text
    expect(byRaw["Missing Note"].target).toBeNull();
  });

  it("is a full rebuild: reindex does not duplicate", () => {
    indexVault(vaultDir);
    const stats = indexVault(vaultDir);
    expect(stats.notes).toBe(2);
    const n = (getDb().prepare("SELECT COUNT(*) AS n FROM notes").get() as { n: number }).n;
    expect(n).toBe(2);
  });

  it("feeds full-text search", () => {
    indexVault(vaultDir);
    const hits = getDb()
      .prepare(`SELECT path FROM notes_fts WHERE notes_fts MATCH ? LIMIT 10`)
      .all('"pipeline"') as Array<{ path: string }>;
    expect(hits.map((h) => h.path)).toContain("wiki/fhir-rag.md");
  });
});
