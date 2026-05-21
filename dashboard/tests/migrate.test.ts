import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import matter from "gray-matter";
import { runMigration } from "@/scripts/migrate-to-0002";

let WORK: string;

beforeEach(() => {
  WORK = fs.mkdtempSync(path.join(os.tmpdir(), "agentic-migrate-"));
  process.env.AGENTIC_OS_REPO_ROOT = WORK;
});

afterEach(() => {
  fs.rmSync(WORK, { recursive: true, force: true });
  delete process.env.AGENTIC_OS_REPO_ROOT;
});

function writeFile(rel: string, contents: string) {
  const full = path.join(WORK, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, contents);
}

function readFile(rel: string): string {
  return fs.readFileSync(path.join(WORK, rel), "utf8");
}

describe("migrate-to-0002 — agents", () => {
  it("flattens agents/<dept>/<name>.md to agents/<slug>.md and derives skills", () => {
    writeFile("agents/research/lit-reviewer.md", `---
name: Literature Reviewer
department: research
created: 2026-01-01
---

body
`);
    runMigration();
    expect(fs.existsSync(path.join(WORK, "agents/lit-reviewer.md"))).toBe(true);
    expect(fs.existsSync(path.join(WORK, "agents/research/lit-reviewer.md"))).toBe(false);
    const parsed = matter(readFile("agents/lit-reviewer.md"));
    expect(parsed.data.skills).toEqual(["research"]);
    expect(parsed.data.runtime).toBe("claude-code");
    expect(parsed.data.department).toBeUndefined();
    expect(parsed.data.slug).toBe("lit-reviewer");
  });

  it("derives created from file mtime when absent", () => {
    writeFile("agents/coding/coder.md", `---
name: Coder
department: coding
---
body
`);
    runMigration();
    const parsed = matter(readFile("agents/coder.md"));
    expect(parsed.data.created).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("converts allowed-tools string to array", () => {
    writeFile("agents/coding/coder.md", `---
name: Coder
department: coding
allowed-tools: "Read Write WebFetch"
created: 2026-01-01
---
body
`);
    runMigration();
    const parsed = matter(readFile("agents/coder.md"));
    expect(parsed.data["allowed-tools"]).toEqual(["Read", "Write", "WebFetch"]);
  });

  it("inlines system-prompt file content as body", () => {
    writeFile("agents/_prompts/coder.md", "You are a coder. Write tight, readable code.");
    writeFile("agents/coding/coder.md", `---
name: Coder
department: coding
system-prompt: ../_prompts/coder.md
created: 2026-01-01
---

orientation paragraph
`);
    runMigration();
    const parsed = matter(readFile("agents/coder.md"));
    expect(parsed.content).toContain("# System Prompt");
    expect(parsed.content).toContain("You are a coder");
    expect(parsed.data["system-prompt"]).toBeUndefined();
  });

  it("strips model, role, allowed-skills", () => {
    writeFile("agents/research/foo.md", `---
name: Foo
department: research
model: sonnet
role: member
allowed-skills:
  - skill-a
  - skill-b
created: 2026-01-01
---
body
`);
    runMigration();
    const parsed = matter(readFile("agents/foo.md"));
    expect(parsed.data.model).toBeUndefined();
    expect(parsed.data.role).toBeUndefined();
    expect(parsed.data["allowed-skills"]).toBeUndefined();
  });

  it("is idempotent on second run", () => {
    writeFile("agents/research/lit-reviewer.md", `---
name: Literature Reviewer
department: research
created: 2026-01-01
---
body
`);
    runMigration();
    const after1 = readFile("agents/lit-reviewer.md");
    runMigration();
    const after2 = readFile("agents/lit-reviewer.md");
    expect(after2).toBe(after1);
  });

  it("refuses to overwrite when a flat file with same slug exists", () => {
    writeFile("agents/lit-reviewer.md", `---
name: x
slug: lit-reviewer
runtime: claude-code
created: 2026-01-01
---
body
`);
    writeFile("agents/research/lit-reviewer.md", `---
name: y
department: research
created: 2026-01-01
---
body
`);
    expect(() => runMigration()).toThrow(/collision/i);
  });
});

describe("migrate-to-0002 — projects", () => {
  it("adds crew, runtime-default, capabilities to PROJECT.md when absent", () => {
    writeFile("vault/projects/qml/PROJECT.md", `---
name: QML
slug: qml
path: /tmp/qml
created: 2026-01-01
---

# QML
`);
    runMigration();
    const parsed = matter(readFile("vault/projects/qml/PROJECT.md"));
    expect(parsed.data.crew).toEqual([]);
    expect(parsed.data["runtime-default"]).toBe("claude-code");
    expect(parsed.data.capabilities).toEqual([]);
  });

  it("renames repo-url to repo", () => {
    writeFile("vault/projects/qml/PROJECT.md", `---
name: QML
slug: qml
path: /tmp/qml
repo-url: https://github.com/x/y
created: 2026-01-01
---
body
`);
    runMigration();
    const parsed = matter(readFile("vault/projects/qml/PROJECT.md"));
    expect(parsed.data.repo).toBe("https://github.com/x/y");
    expect(parsed.data["repo-url"]).toBeUndefined();
  });

  it("derives missing slug from directory name and created from mtime", () => {
    writeFile("vault/projects/no-meta/PROJECT.md", `---
name: No Meta
path: /tmp/no-meta
---
body
`);
    runMigration();
    const parsed = matter(readFile("vault/projects/no-meta/PROJECT.md"));
    expect(parsed.data.slug).toBe("no-meta");
    expect(parsed.data.created).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("migrate-to-0002 — marker", () => {
  it("writes a done marker", () => {
    runMigration();
    expect(fs.existsSync(path.join(WORK, ".agentic-os/migrations/0002.done"))).toBe(true);
  });
});
