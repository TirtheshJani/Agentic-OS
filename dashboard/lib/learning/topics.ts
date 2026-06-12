// dashboard/lib/learning/topics.ts
// Learning topics (spec 0022): vault folders with a SYLLABUS.md, session logs
// written by tutor agents, and an optional srs.md. Tutoring sessions ride the
// existing run pipeline against a dedicated scratch repo (ADR-018): worktrees
// require a git repo, and pointing the learning project at the OS repo would
// copy the whole vault per session.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import matter from "gray-matter";
import { VAULT_DIR, VAULT_PROJECTS_DIR } from "@/lib/paths";
import { slugify, createProjectFromExistingFolder } from "@/lib/projectMutations";
import { getProject } from "@/lib/projects";
import { getSettings } from "@/lib/settings";
import { indexVault } from "@/lib/vault/indexer";
import { publish } from "@/lib/stream";

const LEARNING_DIR = path.join(VAULT_DIR, "learning");
export const LEARNING_PROJECT_SLUG = "learning";

export interface LearningTopic {
  slug: string;
  title: string;
  tutorSlug: string | null;
  created: string;
  sessionCount: number;
  lastSession: string | null;
  hasSrs: boolean;
  syllabus: string;
}

export function learningDirAbs(slug: string): string {
  const clean = slugify(slug);
  if (!clean || clean !== slug) throw new Error(`invalid learning topic slug: ${slug}`);
  return path.join(LEARNING_DIR, slug);
}

function readTopic(slug: string): LearningTopic | null {
  const fp = path.join(LEARNING_DIR, slug, "SYLLABUS.md");
  if (!fs.existsSync(fp)) return null;
  let title = slug;
  let tutorSlug: string | null = null;
  let created = "";
  let syllabus = "";
  try {
    const parsed = matter(fs.readFileSync(fp, "utf8"));
    const fm = parsed.data as Record<string, unknown>;
    if (typeof fm.title === "string" && fm.title) title = fm.title;
    if (typeof fm.tutor === "string") tutorSlug = fm.tutor;
    created = fm.created instanceof Date ? fm.created.toISOString().slice(0, 10) : String(fm.created ?? "");
    syllabus = parsed.content.trim();
  } catch {
    // malformed syllabus stays listed with defaults
  }
  const sessionsDir = path.join(LEARNING_DIR, slug, "sessions");
  const sessions = fs.existsSync(sessionsDir)
    ? fs.readdirSync(sessionsDir).filter((f) => f.endsWith(".md")).sort()
    : [];
  return {
    slug,
    title,
    tutorSlug,
    created,
    sessionCount: sessions.length,
    lastSession: sessions.length > 0 ? sessions[sessions.length - 1].replace(/\.md$/, "") : null,
    hasSrs: fs.existsSync(path.join(LEARNING_DIR, slug, "srs.md")),
    syllabus,
  };
}

export function listTopics(): LearningTopic[] {
  if (!fs.existsSync(LEARNING_DIR)) return [];
  return fs
    .readdirSync(LEARNING_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => readTopic(e.name))
    .filter((t): t is LearningTopic => t !== null)
    .sort((a, b) => a.slug.localeCompare(b.slug));
}

export function getTopic(slug: string): LearningTopic | null {
  learningDirAbs(slug);
  return readTopic(slug);
}

export function createTopic(opts: { title: string; tutorSlug: string; goals?: string }): LearningTopic {
  const slug = slugify(opts.title);
  if (!slug) throw new Error(`cannot derive a slug from title: ${opts.title}`);
  const dir = path.join(LEARNING_DIR, slug);
  if (fs.existsSync(path.join(dir, "SYLLABUS.md"))) throw new Error(`learning topic already exists: ${slug}`);

  fs.mkdirSync(path.join(dir, "sessions"), { recursive: true });
  fs.writeFileSync(
    path.join(dir, "SYLLABUS.md"),
    [
      "---",
      `title: ${opts.title}`,
      `tutor: ${opts.tutorSlug}`,
      `created: ${new Date().toISOString().slice(0, 10)}`,
      "---",
      "",
      `# ${opts.title} — syllabus`,
      "",
      opts.goals?.trim() || "- [ ] Agree initial goals with the tutor in the first session",
      "",
    ].join("\n")
  );
  const stats = indexVault();
  publish({ kind: "vault.indexed", ...stats });
  return readTopic(slug)!;
}

/** Idempotently create the scratch repo tutoring worktrees branch from. */
export function ensureScratchRepo(): string {
  const settings = getSettings();
  const repoPath = path.join(settings.workspaceRoot, "learning-scratch");
  if (fs.existsSync(path.join(repoPath, ".git"))) return repoPath;
  fs.mkdirSync(repoPath, { recursive: true });
  const run = (args: string[]) => {
    const r = spawnSync("git", args, { cwd: repoPath, encoding: "utf8", timeout: 30_000 });
    if (r.status !== 0) throw new Error(`git ${args.join(" ")} failed: ${r.stderr}`);
  };
  run(["init", "-b", "main"]);
  fs.writeFileSync(
    path.join(repoPath, "README.md"),
    "# learning-scratch\n\nThrowaway workspace for Agentic-OS tutoring sessions. Nothing here is kept.\n"
  );
  run(["add", "README.md"]);
  run(["-c", "user.email=agentic-os@local", "-c", "user.name=Agentic OS", "commit", "-m", "init learning scratch"]);
  return repoPath;
}

/** Idempotently register the dashboard project tutoring issues are filed on. */
export function ensureLearningProject(): string {
  if (getProject(LEARNING_PROJECT_SLUG)) return LEARNING_PROJECT_SLUG;
  const repoPath = ensureScratchRepo();
  createProjectFromExistingFolder({
    name: "Learning",
    slug: LEARNING_PROJECT_SLUG,
    folderPath: repoPath,
    vaultProjectsDir: VAULT_PROJECTS_DIR,
    description: "Tutoring sessions (spec 0022). Worktrees are throwaway scratch space.",
    capabilities: ["learning"],
  });
  return LEARNING_PROJECT_SLUG;
}
