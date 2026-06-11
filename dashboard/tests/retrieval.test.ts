import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { openDb, getDb, closeDb } from "@/lib/db";
import { indexVault } from "@/lib/vault/indexer";
import { retrieve } from "@/lib/rag/retrieval";
import type { EmbeddingProvider } from "@/lib/rag/providers/types";

// Deterministic fake provider: maps known keywords onto axis-aligned vectors.
const AXES: Record<string, number> = { quantum: 0, healthcare: 1, finance: 2 };
function fakeVector(text: string): Float32Array {
  const v = new Float32Array(4);
  const lower = text.toLowerCase();
  for (const [word, axis] of Object.entries(AXES)) {
    if (lower.includes(word)) v[axis] = 1;
  }
  if (v.every((x) => x === 0)) v[3] = 1;
  let norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  if (norm === 0) norm = 1;
  return v.map((x) => x / norm) as Float32Array;
}

const fakeProvider: EmbeddingProvider = {
  id: "fake",
  model: "fake-model",
  dims: 4,
  embedDocuments: async (texts) => texts.map(fakeVector),
  embedQuery: async (text) => fakeVector(text),
};

let providerOverride: EmbeddingProvider | null = fakeProvider;
vi.mock("@/lib/rag/providerRegistry", () => ({
  getEmbeddingProvider: () => providerOverride,
}));

let tmp: string;
let vaultDir: string;

function write(rel: string, content: string) {
  const fp = path.join(vaultDir, rel);
  fs.mkdirSync(path.dirname(fp), { recursive: true });
  fs.writeFileSync(fp, content);
}

function embedAllChunks() {
  const rows = getDb().prepare("SELECT DISTINCT content_hash, content FROM note_chunks").all() as Array<{
    content_hash: string;
    content: string;
  }>;
  const insert = getDb().prepare(
    "INSERT OR REPLACE INTO chunk_embeddings (content_hash, model, dims, vector, created_at) VALUES (?, ?, 4, ?, ?)"
  );
  for (const r of rows) {
    insert.run(r.content_hash, "fake-model", Buffer.from(fakeVector(r.content).buffer), Date.now());
  }
}

beforeEach(() => {
  providerOverride = fakeProvider;
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "agentic-retrieval-"));
  vaultDir = path.join(tmp, "vault");
  fs.mkdirSync(vaultDir);
  openDb(path.join(tmp, "state.db"));

  write("wiki/quantum-notes.md", `# Quantum Notes\n\nNotes about quantum computing circuits. ${"q".repeat(320)}\n`);
  write(
    "wiki/healthcare-ai.md",
    `# Healthcare AI\n\nNotes about healthcare models. Links to [[quantum-notes]]. ${"h".repeat(320)}\n`
  );
  write("wiki/finance.md", `# Finance\n\nNotes about finance budgeting. ${"f".repeat(320)}\n`);
  write("projects/p1/knowledge/quantum-extra.md", `# Quantum Extra\n\nMore quantum material. ${"e".repeat(320)}\n`);
  indexVault(vaultDir);
  embedAllChunks();
});

afterEach(() => {
  closeDb();
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe("retrieve", () => {
  it("ranks vector matches for the query topic first", async () => {
    const r = await retrieve({ q: "quantum" });
    expect(r.degraded.vector).toBe(false);
    expect(r.chunks.length).toBeGreaterThan(0);
    expect(r.chunks[0].notePath).toMatch(/quantum/);
    expect(r.chunks[0].retrievers).toContain("vector");
  });

  it("fuses FTS hits with vector hits", async () => {
    const r = await retrieve({ q: "budgeting" });
    // "budgeting" appears literally only in finance.md; FTS must surface it.
    const finance = r.chunks.find((c) => c.notePath === "wiki/finance.md");
    expect(finance).toBeDefined();
    expect(finance!.retrievers).toContain("fts");
  });

  it("expands one hop along wikilinks", async () => {
    const r = await retrieve({ q: "healthcare" });
    // healthcare-ai links to quantum-notes; quantum-notes should arrive via graph.
    const viaGraph = r.chunks.find((c) => c.notePath === "wiki/quantum-notes.md");
    expect(viaGraph).toBeDefined();
    expect(viaGraph!.retrievers).toContain("graph");
  });

  it("respects pathPrefix scope", async () => {
    const r = await retrieve({ q: "quantum", scope: { pathPrefix: "projects/p1/" } });
    expect(r.chunks.length).toBeGreaterThan(0);
    for (const c of r.chunks) {
      expect(c.notePath.startsWith("projects/p1/")).toBe(true);
    }
  });

  it("respects exact-paths scope", async () => {
    const r = await retrieve({ q: "quantum", scope: { paths: ["wiki/quantum-notes.md"] } });
    for (const c of r.chunks) {
      expect(c.notePath).toBe("wiki/quantum-notes.md");
    }
  });

  it("degrades to FTS + graph without a provider", async () => {
    providerOverride = null;
    const r = await retrieve({ q: "budgeting" });
    expect(r.degraded.vector).toBe(true);
    expect(r.degraded.reason).toBeTruthy();
    expect(r.chunks.some((c) => c.notePath === "wiki/finance.md")).toBe(true);
    for (const c of r.chunks) {
      expect(c.retrievers).not.toContain("vector");
    }
  });
});
