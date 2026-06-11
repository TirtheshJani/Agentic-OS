import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { openDb, getDb, closeDb } from "@/lib/db";
import { indexVault } from "@/lib/vault/indexer";
import { resetBusForTesting, publish } from "@/lib/stream";
import type { EmbeddingProvider } from "@/lib/rag/providers/types";

let embedCalls: string[][] = [];
let failNext = false;

const fakeProvider: EmbeddingProvider = {
  id: "fake",
  model: "fake-model",
  dims: 4,
  embedDocuments: async (texts) => {
    if (failNext) {
      failNext = false;
      throw new Error("simulated provider outage");
    }
    embedCalls.push(texts);
    return texts.map(() => new Float32Array([1, 0, 0, 0]));
  },
  embedQuery: async () => new Float32Array([1, 0, 0, 0]),
};

let providerOverride: EmbeddingProvider | null = fakeProvider;
vi.mock("@/lib/rag/providerRegistry", () => ({
  getEmbeddingProvider: () => providerOverride,
}));

// Import after the mock so the worker sees the fake registry.
const { startEmbedWorker, kickEmbedWorker, getEmbedWorkerStatus } = await import("@/lib/rag/embedWorker");

let tmp: string;
let vaultDir: string;
let stopWorker: (() => void) | null = null;

function write(rel: string, content: string) {
  const fp = path.join(vaultDir, rel);
  fs.mkdirSync(path.dirname(fp), { recursive: true });
  fs.writeFileSync(fp, content);
}

function embeddedCount(): number {
  return (getDb().prepare("SELECT COUNT(*) AS n FROM chunk_embeddings WHERE model = 'fake-model'").get() as { n: number }).n;
}

async function settle() {
  // The worker drains asynchronously; a few macrotask turns are enough.
  for (let i = 0; i < 10; i++) await new Promise((r) => setTimeout(r, 20));
}

beforeEach(() => {
  embedCalls = [];
  failNext = false;
  providerOverride = fakeProvider;
  resetBusForTesting();
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "agentic-embed-"));
  vaultDir = path.join(tmp, "vault");
  fs.mkdirSync(vaultDir);
  openDb(path.join(tmp, "state.db"));
  write("wiki/one.md", `# One\n\nFirst note body. ${"o".repeat(320)}\n`);
  write("wiki/two.md", `# Two\n\nSecond note body. ${"t".repeat(320)}\n`);
  indexVault(vaultDir);
});

afterEach(() => {
  stopWorker?.();
  stopWorker = null;
  resetBusForTesting();
  closeDb();
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe("embedWorker", () => {
  it("embeds all pending hashes on start and is idempotent", async () => {
    stopWorker = startEmbedWorker();
    await settle();
    const first = embeddedCount();
    expect(first).toBeGreaterThanOrEqual(2);
    const callsAfterFirst = embedCalls.length;

    kickEmbedWorker();
    await settle();
    expect(embeddedCount()).toBe(first);
    expect(embedCalls.length).toBe(callsAfterFirst); // nothing left to embed
  });

  it("drains again on vault.indexed events", async () => {
    stopWorker = startEmbedWorker();
    await settle();
    const before = embeddedCount();

    write("wiki/three.md", `# Three\n\nThird note body. ${"x".repeat(320)}\n`);
    indexVault(vaultDir); // indexVault publishes nothing itself in tests; emit the event the watcher would
    publish({ kind: "vault.indexed", notes: 3, links: 0 });
    await settle();
    expect(embeddedCount()).toBeGreaterThan(before);
  });

  it("records provider errors without throwing and recovers on kick", async () => {
    failNext = true;
    stopWorker = startEmbedWorker();
    await settle();
    expect(getEmbedWorkerStatus().lastError).toContain("simulated provider outage");

    kickEmbedWorker(); // clears backoff
    await settle();
    expect(embeddedCount()).toBeGreaterThanOrEqual(2);
    expect(getEmbedWorkerStatus().lastError).toBeNull();
  });

  it("does nothing without a provider", async () => {
    providerOverride = null;
    stopWorker = startEmbedWorker();
    await settle();
    expect(embeddedCount()).toBe(0);
  });
});
