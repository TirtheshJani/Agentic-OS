import { TEST_REPO_ROOT, cleanupTestRepoRoot } from "./helpers/repoRootStub";
import { describe, it, expect, beforeEach, afterEach, afterAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { resetSettingsForTesting, setSettings } from "@/lib/settings";
import { exportBundle } from "@/lib/export/notebooklm";

const vaultDir = path.join(TEST_REPO_ROOT, "vault");

beforeEach(() => {
  process.env.AGENTIC_OS_STATE_DIR = path.join(TEST_REPO_ROOT, ".agentic-os");
  resetSettingsForTesting();
  fs.mkdirSync(path.join(vaultDir, "wiki"), { recursive: true });
  fs.writeFileSync(
    path.join(vaultDir, "wiki", "topic-a.md"),
    "# Topic A\n\nSee [[topic-b]] and [[wiki/topic-b|the other one]].\n"
  );
  fs.writeFileSync(path.join(vaultDir, "wiki", "topic-b.md"), "# Topic B\n\nContent.\n");
});

afterEach(() => {
  resetSettingsForTesting();
  fs.rmSync(vaultDir, { recursive: true, force: true });
});

afterAll(() => {
  cleanupTestRepoRoot();
});

describe("exportBundle", () => {
  it("copies notes with flattened names, wikilinks resolved, plus a manifest", () => {
    const result = exportBundle({ paths: ["wiki/topic-a.md", "wiki/topic-b.md"], bundleName: "My Research" });
    expect(result.exportedTo).toContain(path.join("vault", "outputs", "notebooklm"));
    expect(result.files).toEqual(["wiki-topic-a.md", "wiki-topic-b.md", "_manifest.md"]);

    const a = fs.readFileSync(path.join(result.exportedTo, "wiki-topic-a.md"), "utf8");
    expect(a).toContain("See topic-b and the other one.");
    expect(a).not.toContain("[[");

    const manifest = fs.readFileSync(path.join(result.exportedTo, "_manifest.md"), "utf8");
    expect(manifest).toContain("wiki-topic-a.md <- vault/wiki/topic-a.md");
  });

  it("uses the configured export dir and avoids collisions", () => {
    const target = path.join(TEST_REPO_ROOT, "drive-inbox");
    setSettings({ export: { notebookLmDir: target } });
    const first = exportBundle({ paths: ["wiki/topic-a.md"], bundleName: "same" });
    const second = exportBundle({ paths: ["wiki/topic-a.md"], bundleName: "same" });
    expect(first.exportedTo.startsWith(target)).toBe(true);
    expect(second.exportedTo).not.toBe(first.exportedTo);
  });

  it("rejects traversal, missing notes, and empty selections", () => {
    expect(() => exportBundle({ paths: ["../outside.md"] })).toThrow();
    expect(() => exportBundle({ paths: ["wiki/missing.md"] })).toThrow(/not found/);
    expect(() => exportBundle({ paths: [] })).toThrow(/no notes/);
  });
});
