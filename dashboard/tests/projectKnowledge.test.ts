// repoRootStub must be imported before any @/lib module so VAULT_DIR points
// at a temp directory.
import { TEST_REPO_ROOT, cleanupTestRepoRoot } from "./helpers/repoRootStub";
import { describe, it, expect, beforeEach, afterEach, afterAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { openDb, getDb, closeDb } from "@/lib/db";
import { resetBusForTesting } from "@/lib/stream";
import {
  listKnowledgeDocs,
  saveKnowledgeDoc,
  deleteKnowledgeDoc,
  readInstructions,
  writeInstructions,
  listOutputs,
  knowledgeScopePrefix,
} from "@/lib/projectKnowledge";

const SLUG = "test-proj";
const vaultDir = path.join(TEST_REPO_ROOT, "vault");

beforeEach(() => {
  fs.mkdirSync(path.join(vaultDir, "projects", SLUG), { recursive: true });
  openDb(path.join(TEST_REPO_ROOT, `state-${Date.now()}-${Math.random()}.db`));
});

afterEach(() => {
  resetBusForTesting();
  closeDb();
  fs.rmSync(path.join(vaultDir, "projects", SLUG), { recursive: true, force: true });
});

afterAll(() => {
  cleanupTestRepoRoot();
});

describe("projectKnowledge", () => {
  it("saves a doc with auto-frontmatter, kebab name, and indexes it immediately", () => {
    const relPath = saveKnowledgeDoc(SLUG, "My Notes File.txt", "Plain text body about quantum stuff.");
    expect(relPath).toBe(`projects/${SLUG}/knowledge/my-notes-file.md`);
    const abs = path.join(vaultDir, relPath);
    const raw = fs.readFileSync(abs, "utf8");
    expect(raw.startsWith("---\nsource: upload")).toBe(true);
    expect(raw).toContain("Plain text body");

    // Indexed synchronously: row exists in notes already.
    const row = getDb().prepare("SELECT path FROM notes WHERE path = ?").get(relPath);
    expect(row).toBeDefined();
  });

  it("keeps existing frontmatter as-is", () => {
    const relPath = saveKnowledgeDoc(SLUG, "with-fm", "---\ntitle: Custom\n---\n\nBody.");
    const raw = fs.readFileSync(path.join(vaultDir, relPath), "utf8");
    expect(raw.startsWith("---\ntitle: Custom")).toBe(true);
    expect(raw).not.toContain("source: upload");
  });

  it("sanitizes traversal attempts and rejects garbage names", () => {
    // Separators are stripped by sanitization; the file lands inside the folder.
    const relPath = saveKnowledgeDoc(SLUG, "../../evil", "x");
    expect(relPath).toBe(`projects/${SLUG}/knowledge/evil.md`);
    expect(fs.existsSync(path.join(vaultDir, "projects", SLUG, "knowledge", "evil.md"))).toBe(true);
    expect(() => saveKnowledgeDoc(SLUG, "...", "x")).toThrow();
    expect(() => saveKnowledgeDoc("Bad Slug!", "ok", "x")).toThrow();
    expect(() => deleteKnowledgeDoc(SLUG, "../escape.md")).toThrow();
  });

  it("lists and deletes docs", () => {
    saveKnowledgeDoc(SLUG, "alpha", "Alpha content.");
    saveKnowledgeDoc(SLUG, "beta", "Beta content.");
    const docs = listKnowledgeDocs(SLUG);
    expect(docs.map((d) => d.name)).toEqual(["alpha.md", "beta.md"]);
    expect(docs[0].chunkCount).toBeGreaterThanOrEqual(0);

    expect(deleteKnowledgeDoc(SLUG, "alpha.md")).toBe(true);
    expect(deleteKnowledgeDoc(SLUG, "alpha.md")).toBe(false);
    expect(listKnowledgeDocs(SLUG).map((d) => d.name)).toEqual(["beta.md"]);
  });

  it("round-trips instructions", () => {
    expect(readInstructions(SLUG)).toBe("");
    writeInstructions(SLUG, "Always use TypeScript strict.");
    expect(readInstructions(SLUG)).toBe("Always use TypeScript strict.");
  });

  it("lists outputs newest-first", () => {
    const outDir = path.join(vaultDir, "projects", SLUG, "outputs");
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, "report.md"), "r");
    expect(listOutputs(SLUG).map((o) => o.name)).toEqual(["report.md"]);
    expect(listOutputs("nonexistent-proj")).toEqual([]);
  });

  it("exposes the retrieval scope prefix", () => {
    expect(knowledgeScopePrefix(SLUG)).toBe(`projects/${SLUG}/knowledge/`);
  });
});
