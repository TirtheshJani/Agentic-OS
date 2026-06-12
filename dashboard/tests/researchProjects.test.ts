import { TEST_REPO_ROOT, cleanupTestRepoRoot } from "./helpers/repoRootStub";
import { describe, it, expect, beforeEach, afterEach, afterAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { openDb, closeDb } from "@/lib/db";
import { resetBusForTesting } from "@/lib/stream";
import {
  createResearchProject,
  listResearchProjects,
  getResearchProject,
  listSources,
  researchScopePrefix,
} from "@/lib/research/projects";

const researchDir = path.join(TEST_REPO_ROOT, "vault", "research");

beforeEach(() => {
  openDb(path.join(TEST_REPO_ROOT, `state-research-${Date.now()}-${Math.random()}.db`));
});

afterEach(() => {
  resetBusForTesting();
  closeDb();
  fs.rmSync(researchDir, { recursive: true, force: true });
});

afterAll(() => {
  cleanupTestRepoRoot();
});

describe("research projects", () => {
  it("creates a project with RESEARCH.md, sources/ and notes/", () => {
    const p = createResearchProject({ title: "Quantum Healthcare", question: "Can QML help diagnostics?", tags: ["qml"] });
    expect(p.slug).toBe("quantum-healthcare");
    expect(p.status).toBe("open");
    expect(p.question).toBe("Can QML help diagnostics?");
    expect(fs.existsSync(path.join(researchDir, p.slug, "sources"))).toBe(true);
    expect(fs.existsSync(path.join(researchDir, p.slug, "notes"))).toBe(true);
    expect(() => createResearchProject({ title: "Quantum Healthcare", question: "again" })).toThrow(/already exists/);
  });

  it("lists projects with counts and reads sources with provenance", () => {
    const p = createResearchProject({ title: "Topic", question: "Q?" });
    const srcDir = path.join(researchDir, p.slug, "sources");
    fs.writeFileSync(
      path.join(srcDir, "good-source.md"),
      "---\nsource-url: https://example.com/a\nsource-type: web\ncollected-by: researcher\ncollected-at: 2026-06-11\n---\n\nSummary.\n"
    );
    fs.writeFileSync(path.join(srcDir, "bare-source.md"), "No frontmatter at all.\n");

    const listed = listResearchProjects();
    expect(listed.length).toBe(1);
    expect(listed[0].sourceCount).toBe(2);

    const sources = listSources(p.slug);
    const good = sources.find((s) => s.name === "good-source.md")!;
    expect(good.attributed).toBe(true);
    expect(good.sourceUrl).toBe("https://example.com/a");
    expect(good.sourceType).toBe("web");
    const bare = sources.find((s) => s.name === "bare-source.md")!;
    expect(bare.attributed).toBe(false);
  });

  it("tolerates a malformed RESEARCH.md", () => {
    const dir = path.join(researchDir, "broken");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "RESEARCH.md"), "---\ntitle: [unclosed\n---\nbody");
    const p = getResearchProject("broken");
    expect(p).not.toBeNull();
    expect(p!.title).toBe("broken");
    expect(p!.status).toBe("open");
  });

  it("rejects invalid slugs and exposes the scope prefix", () => {
    expect(() => listSources("../evil")).toThrow(/invalid research slug/);
    expect(researchScopePrefix("topic")).toBe("research/topic/");
  });
});
