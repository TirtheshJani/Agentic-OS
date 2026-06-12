import { TEST_REPO_ROOT, cleanupTestRepoRoot } from "./helpers/repoRootStub";
import { describe, it, expect, beforeEach, afterEach, afterAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { openDb, getDb, closeDb } from "@/lib/db";
import { resetBusForTesting, subscribe } from "@/lib/stream";
import { createNote, updateNote, appendToDaily, suggestNotes } from "@/lib/vault/noteWriter";

const vaultDir = path.join(TEST_REPO_ROOT, "vault");

beforeEach(() => {
  fs.mkdirSync(vaultDir, { recursive: true });
  openDb(path.join(TEST_REPO_ROOT, `state-notes-${Date.now()}-${Math.random()}.db`));
});

afterEach(() => {
  resetBusForTesting();
  closeDb();
  fs.rmSync(vaultDir, { recursive: true, force: true });
});

afterAll(() => {
  cleanupTestRepoRoot();
});

describe("createNote", () => {
  it("writes daily-style frontmatter under raw/ and indexes immediately", () => {
    const { relPath } = createNote({ folder: "raw/daily", title: "Quick Thought", content: "Body text." });
    expect(relPath).toBe("raw/daily/quick-thought.md");
    const raw = fs.readFileSync(path.join(vaultDir, relPath), "utf8");
    expect(raw).toMatch(/^---\ndate: \d{4}-\d{2}-\d{2}\ndomain: \[\]\nsource: dashboard\n---/);
    expect(raw).toContain("# Quick Thought");
    const row = getDb().prepare("SELECT path FROM notes WHERE path = ?").get(relPath);
    expect(row).toBeDefined();
  });

  it("writes wiki frontmatter with the domain from the folder", () => {
    const { relPath } = createNote({ folder: "wiki/coding", title: "TS Tips", content: "Tips." });
    const raw = fs.readFileSync(path.join(vaultDir, relPath), "utf8");
    expect(raw).toContain("domain: coding");
    expect(raw).toMatch(/created: \d{4}-\d{2}-\d{2}/);
    expect(raw).toMatch(/updated: \d{4}-\d{2}-\d{2}/);
  });

  it("refuses overwrites, traversal, and disallowed folders", () => {
    createNote({ folder: "raw", title: "Once", content: "x" });
    expect(() => createNote({ folder: "raw", title: "Once", content: "y" })).toThrow(/already exists/);
    expect(() => createNote({ folder: "raw/../..", title: "evil", content: "x" })).toThrow();
    expect(() => createNote({ folder: "secrets", title: "nope", content: "x" })).toThrow(/folder must be under/);
  });

  it("publishes vault.indexed", () => {
    let seen = 0;
    const unsub = subscribe((e) => {
      if (e.kind === "vault.indexed") seen++;
    });
    createNote({ folder: "raw", title: "Eventful", content: "x" });
    unsub();
    expect(seen).toBe(1);
  });
});

describe("updateNote", () => {
  it("bumps updated: frontmatter and reindexes", () => {
    const { relPath } = createNote({ folder: "wiki/coding", title: "Living Doc", content: "v1" });
    const stale = fs
      .readFileSync(path.join(vaultDir, relPath), "utf8")
      .replace(/updated: \d{4}-\d{2}-\d{2}/, "updated: 2020-01-01");
    updateNote(relPath, stale.replace("v1", "v2"));
    const raw = fs.readFileSync(path.join(vaultDir, relPath), "utf8");
    expect(raw).toContain("v2");
    expect(raw).not.toContain("updated: 2020-01-01");
  });

  it("rejects unknown paths and traversal", () => {
    expect(() => updateNote("raw/missing.md", "x")).toThrow(/not found/);
    expect(() => updateNote("../outside.md", "x")).toThrow();
  });
});

describe("appendToDaily", () => {
  it("creates today's note with frontmatter then appends timestamped lines", () => {
    const { relPath } = appendToDaily("first capture");
    appendToDaily("second capture");
    const raw = fs.readFileSync(path.join(vaultDir, relPath), "utf8");
    expect(raw.startsWith("---\ndate:")).toBe(true);
    expect(raw).toMatch(/- \d{2}:\d{2} — first capture\n/);
    expect(raw).toMatch(/- \d{2}:\d{2} — second capture\n/);
    expect(() => appendToDaily("   ")).toThrow(/empty/);
  });
});

describe("suggestNotes", () => {
  it("suggests by basename and title prefix", () => {
    createNote({ folder: "wiki/coding", title: "Refactoring Patterns", content: "x" });
    createNote({ folder: "raw", title: "Random Idea", content: "x" });
    expect(suggestNotes("refac").map((s) => s.path)).toEqual(["wiki/coding/refactoring-patterns.md"]);
    expect(suggestNotes("random idea").length).toBe(1);
    expect(suggestNotes("")).toEqual([]);
  });
});
