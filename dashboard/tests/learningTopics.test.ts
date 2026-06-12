import { TEST_REPO_ROOT, cleanupTestRepoRoot } from "./helpers/repoRootStub";
import { describe, it, expect, beforeEach, afterEach, afterAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { openDb, closeDb } from "@/lib/db";
import { resetBusForTesting } from "@/lib/stream";
import { resetSettingsForTesting, setSettings } from "@/lib/settings";
import { listTopics, getTopic, createTopic, ensureScratchRepo, learningDirAbs } from "@/lib/learning/topics";

const learningDir = path.join(TEST_REPO_ROOT, "vault", "learning");

beforeEach(() => {
  process.env.AGENTIC_OS_STATE_DIR = path.join(TEST_REPO_ROOT, `.agentic-os-learn-${Date.now()}-${Math.random()}`);
  resetSettingsForTesting();
  openDb(path.join(TEST_REPO_ROOT, `state-learn-${Date.now()}-${Math.random()}.db`));
});

afterEach(() => {
  resetBusForTesting();
  resetSettingsForTesting();
  closeDb();
  fs.rmSync(learningDir, { recursive: true, force: true });
});

afterAll(() => {
  cleanupTestRepoRoot();
});

describe("learning topics", () => {
  it("creates a topic with syllabus frontmatter and sessions dir", () => {
    const t = createTopic({ title: "Linear Algebra", tutorSlug: "socratic-tutor", goals: "- [ ] eigenvalues" });
    expect(t.slug).toBe("linear-algebra");
    expect(t.tutorSlug).toBe("socratic-tutor");
    expect(t.syllabus).toContain("eigenvalues");
    expect(fs.existsSync(path.join(learningDir, "linear-algebra", "sessions"))).toBe(true);
    expect(() => createTopic({ title: "Linear Algebra", tutorSlug: "x" })).toThrow(/already exists/);
  });

  it("lists topics with session counts and srs flag", () => {
    createTopic({ title: "Topic A", tutorSlug: "socratic-tutor" });
    fs.writeFileSync(path.join(learningDir, "topic-a", "sessions", "2026-06-10.md"), "log");
    fs.writeFileSync(path.join(learningDir, "topic-a", "srs.md"), "- Q: x / A: y / last-reviewed: 2026-06-01");
    const topics = listTopics();
    expect(topics.length).toBe(1);
    expect(topics[0].sessionCount).toBe(1);
    expect(topics[0].lastSession).toBe("2026-06-10");
    expect(topics[0].hasSrs).toBe(true);
    expect(getTopic("topic-a")?.title).toBe("Topic A");
  });

  it("rejects invalid slugs", () => {
    expect(() => learningDirAbs("../evil")).toThrow(/invalid learning topic slug/);
  });

  it("ensureScratchRepo creates a real git repo idempotently", () => {
    const workspace = fs.mkdtempSync(path.join(TEST_REPO_ROOT, "ws-"));
    setSettings({ workspaceRoot: workspace });
    const first = ensureScratchRepo();
    expect(fs.existsSync(path.join(first, ".git"))).toBe(true);
    expect(fs.existsSync(path.join(first, "README.md"))).toBe(true);
    const second = ensureScratchRepo();
    expect(second).toBe(first);
  });
});
