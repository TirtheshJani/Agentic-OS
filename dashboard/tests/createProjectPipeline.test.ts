// repoRootStub MUST be the first import: it points REPO_ROOT (and the SQLite
// state dir) at a throwaway temp directory before any @/lib module loads.
import { TEST_REPO_ROOT, cleanupTestRepoRoot } from "./helpers/repoRootStub";
import { describe, it, expect, beforeEach, afterAll, beforeAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { runPipeline, resolveProjectSlug, type ExecFn, type PipelineDeps } from "@/lib/createProject/pipeline";
import { createJob, resetJobsForTesting, type CreateJobInput } from "@/lib/createProject/jobs";
import { CREATE_STEPS } from "@/lib/createProject/steps";
import { resetBusForTesting } from "@/lib/stream";
import { registerRuntime, resetRegistryForTesting } from "@/lib/runtime/registry";
import { listIssues, deleteIssue } from "@/lib/issues";
import { openDb, closeDb } from "@/lib/db";
import type { Runtime } from "@/lib/runtime/types";

const DRAFT_JSON = {
  project: {
    name: "Moon Phase CLI",
    slug: "moon-phase-cli",
    description: "A CLI that prints the current moon phase.",
    capabilities: ["cli", "astronomy"],
  },
  team: [
    {
      name: "moon-dev",
      slug: "moon-dev",
      description: "Implements the moon CLI.",
      skills: [],
      allowedTools: ["Read", "Write", "Bash"],
      systemPrompt: "You build the moon phase CLI.",
      runtime: "claude-code",
    },
    {
      name: "moon-reviewer",
      slug: "moon-reviewer",
      description: "Reviews moon CLI changes.",
      skills: [],
      allowedTools: ["Read"],
      systemPrompt: "You review the moon CLI.",
      runtime: "claude-code",
    },
  ],
  seedIssues: [
    { title: "Scaffold the CLI entry point", body: "Set up the binary." },
    { title: "Implement the phase algorithm", body: "Add the math with tests." },
    { title: "Write the README", body: "Usage and install." },
  ],
};

const INPUT: CreateJobInput = {
  prompt: "Build a small CLI that prints the current moon phase.",
  visibility: "private",
  runtimeDefault: "claude-code",
  fileIssues: true,
};

interface ExecCall {
  cmd: string;
  args: string[];
  cwd?: string;
}

function makeExec(opts: { ghFails?: boolean; gitCommitFails?: boolean } = {}) {
  const calls: ExecCall[] = [];
  const exec: ExecFn = (cmd, args, o) => {
    calls.push({ cmd, args, cwd: o?.cwd });
    if (cmd === "gh") {
      if (opts.ghFails) return { ok: false, status: 1, stdout: "", stderr: "GraphQL: Name already exists" };
      return {
        ok: true,
        status: 0,
        stdout: `https://github.com/TirtheshJani/${args[2]}\n`,
        stderr: "",
      };
    }
    if (cmd === "git" && args[0] === "commit" && opts.gitCommitFails) {
      return { ok: false, status: 128, stdout: "", stderr: "fatal: empty ident name" };
    }
    return { ok: true, status: 0, stdout: "", stderr: "" };
  };
  return { exec, calls };
}

const fakeRuntime: Runtime = {
  id: "claude-code",
  displayName: "Claude Code",
  capabilities: {
    sessionResume: true,
    sessionIdCapture: true,
    hooks: true,
    transcriptCostParsing: false,
    externalTerminalEscape: true,
  },
  detect: async () => ({ available: true, version: "test" }),
  spawn: async () => {
    throw new Error("not used in tests");
  },
  formatResumeCommand: (sid) => `claude --resume ${sid}`,
};

let workspaceRoot: string;
let vaultProjectsDir: string;
let agentsDir: string;
let skillsRootDir: string;

function makeDeps(exec: ExecFn, extra: Partial<PipelineDeps> = {}): PipelineDeps {
  return {
    exec,
    runDraft: () => ({ ok: true, raw: JSON.stringify(DRAFT_JSON) }),
    preflight: async () => ({ ok: true, failures: [], warnings: [] }),
    workspaceRoot,
    vaultProjectsDir,
    agentsDir,
    skillsRootDir,
    ...extra,
  };
}

beforeAll(() => {
  openDb();
  registerRuntime(fakeRuntime);
});

beforeEach(() => {
  resetJobsForTesting();
  resetBusForTesting();
  // Fresh dirs per test, all inside the stubbed repo root.
  const base = fs.mkdtempSync(path.join(TEST_REPO_ROOT, "case-"));
  workspaceRoot = path.join(base, "workspace");
  vaultProjectsDir = path.join(base, "vault-projects");
  agentsDir = path.join(base, "agents");
  skillsRootDir = path.join(base, "skills");
  for (const d of [workspaceRoot, vaultProjectsDir, agentsDir, skillsRootDir]) {
    fs.mkdirSync(d, { recursive: true });
  }
  // Issues accumulate in the shared test DB; clear between cases.
  for (const issue of listIssues()) deleteIssue(issue.id);
});

afterAll(() => {
  resetRegistryForTesting();
  closeDb();
  cleanupTestRepoRoot();
});

describe("resolveProjectSlug", () => {
  it("returns the base when free and suffixes when taken", () => {
    expect(resolveProjectSlug("moon", { vaultProjectsDir, workspaceRoot })).toBe("moon");
    fs.mkdirSync(path.join(workspaceRoot, "moon"));
    expect(resolveProjectSlug("moon", { vaultProjectsDir, workspaceRoot })).toBe("moon-2");
    fs.mkdirSync(path.join(vaultProjectsDir, "moon-2"), { recursive: true });
    fs.writeFileSync(path.join(vaultProjectsDir, "moon-2", "PROJECT.md"), "x");
    expect(resolveProjectSlug("moon", { vaultProjectsDir, workspaceRoot })).toBe("moon-3");
  });
});

describe("runPipeline", () => {
  it("happy path: full step sequence, artifacts, crew, backlog issues", async () => {
    const { exec, calls } = makeExec();
    const job = createJob(INPUT);
    await runPipeline(job, makeDeps(exec));

    expect(job.status).toBe("succeeded");
    expect(job.steps.map((s) => [s.id, s.status])).toEqual([
      ["preflight", "done"],
      ["draft", "done"],
      ["resolve", "done"],
      ["scaffold", "done"],
      ["github", "done"],
      ["register", "done"],
      ["agents", "done"],
      ["issues", "done"],
    ]);

    const target = path.join(workspaceRoot, "moon-phase-cli");
    expect(job.result.projectSlug).toBe("moon-phase-cli");
    expect(job.result.projectPath).toBe(target);
    for (const f of ["README.md", ".gitignore", "CLAUDE.md"]) {
      expect(fs.existsSync(path.join(target, f))).toBe(true);
    }
    expect(fs.readFileSync(path.join(target, "README.md"), "utf8")).toContain("Moon Phase CLI");

    // git scaffold sequence ran in the target dir.
    const gitCalls = calls.filter((c) => c.cmd === "git");
    expect(gitCalls.map((c) => c.args[0])).toEqual(["init", "add", "commit"]);
    expect(gitCalls.every((c) => c.cwd === target)).toBe(true);

    // gh repo create with the exact contract.
    const gh = calls.find((c) => c.cmd === "gh")!;
    expect(gh.args.slice(0, 3)).toEqual(["repo", "create", "moon-phase-cli"]);
    expect(gh.args).toContain("--private");
    expect(gh.args).toContain("--source");
    expect(gh.args).toContain("--push");
    expect(gh.cwd).toBe(target);
    expect(job.result.repoUrl).toBe("https://github.com/TirtheshJani/moon-phase-cli");

    // Vault registration.
    const projectFile = path.join(vaultProjectsDir, "moon-phase-cli", "PROJECT.md");
    expect(fs.existsSync(projectFile)).toBe(true);
    const fm = matter(fs.readFileSync(projectFile, "utf8")).data;
    expect(fm.slug).toBe("moon-phase-cli");
    expect(fm.path).toBe(target);
    expect(fm["runtime-default"]).toBe("claude-code");
    expect(fm.description).toContain("moon phase");
    expect(fm.crew).toEqual(["moon-dev", "moon-reviewer"]);

    // Agents on disk.
    expect(fs.existsSync(path.join(agentsDir, "moon-dev.md"))).toBe(true);
    expect(fs.existsSync(path.join(agentsDir, "moon-reviewer.md"))).toBe(true);
    expect(job.result.agentsCreated).toEqual(["moon-dev", "moon-reviewer"]);

    // Backlog issues.
    const issues = listIssues({ projectSlug: "moon-phase-cli" });
    expect(issues).toHaveLength(3);
    expect(issues.every((i) => i.status === "backlog")).toBe(true);
    expect(job.result.issueIds).toHaveLength(3);
  });

  it("gh failure degrades to a warning and the job still succeeds", async () => {
    const { exec } = makeExec({ ghFails: true });
    const job = createJob(INPUT);
    await runPipeline(job, makeDeps(exec));

    expect(job.status).toBe("succeeded");
    const github = job.steps.find((s) => s.id === "github")!;
    expect(github.status).toBe("warning");
    expect(job.result.repoUrl).toBeNull();
    expect(job.result.warnings.some((w) => w.includes("gh repo create"))).toBe(true);
  });

  it("local-only skips the github step entirely", async () => {
    const { exec, calls } = makeExec();
    const job = createJob({ ...INPUT, visibility: "local-only" });
    await runPipeline(job, makeDeps(exec));

    expect(job.status).toBe("succeeded");
    expect(job.steps.find((s) => s.id === "github")!.status).toBe("skipped");
    expect(calls.some((c) => c.cmd === "gh")).toBe(false);
    expect(job.result.repoUrl).toBeNull();
  });

  it("preflight failure aborts before any folder is created", async () => {
    const { exec, calls } = makeExec();
    const job = createJob(INPUT);
    await runPipeline(
      job,
      makeDeps(exec, {
        preflight: async () => ({ ok: false, failures: ["gh CLI is not authenticated"], warnings: [] }),
      })
    );

    expect(job.status).toBe("failed");
    expect(job.steps.find((s) => s.id === "preflight")!.status).toBe("failed");
    expect(job.steps.find((s) => s.id === "draft")!.status).toBe("pending");
    expect(fs.readdirSync(workspaceRoot)).toEqual([]);
    expect(calls).toEqual([]);
  });

  it("unparseable draft aborts with the raw excerpt", async () => {
    const { exec } = makeExec();
    const job = createJob(INPUT);
    await runPipeline(
      job,
      makeDeps(exec, { runDraft: () => ({ ok: true, raw: "Sorry, I cannot do that." }) })
    );

    expect(job.status).toBe("failed");
    const draft = job.steps.find((s) => s.id === "draft")!;
    expect(draft.status).toBe("failed");
    expect(draft.error).toContain("Sorry");
  });

  it("suffixes the project slug when vault entry already exists", async () => {
    fs.mkdirSync(path.join(vaultProjectsDir, "moon-phase-cli"), { recursive: true });
    fs.writeFileSync(path.join(vaultProjectsDir, "moon-phase-cli", "PROJECT.md"), "taken");

    const { exec } = makeExec();
    const job = createJob(INPUT);
    await runPipeline(job, makeDeps(exec));

    expect(job.status).toBe("succeeded");
    expect(job.result.projectSlug).toBe("moon-phase-cli-2");
    expect(fs.existsSync(path.join(workspaceRoot, "moon-phase-cli-2"))).toBe(true);
  });

  it("reuses an existing agent instead of recreating it", async () => {
    fs.writeFileSync(
      path.join(agentsDir, "moon-dev.md"),
      matter.stringify("# System Prompt\n\nExisting.", {
        name: "moon-dev",
        slug: "moon-dev",
        runtime: "claude-code",
        skills: [],
        "allowed-tools": [],
        created: "2026-01-01",
      })
    );
    const before = fs.statSync(path.join(agentsDir, "moon-dev.md")).mtimeMs;

    const { exec } = makeExec();
    const job = createJob(INPUT);
    await runPipeline(job, makeDeps(exec));

    expect(job.status).toBe("succeeded");
    expect(job.result.agentsReused).toEqual(["moon-dev"]);
    expect(job.result.agentsCreated).toEqual(["moon-reviewer"]);
    expect(fs.statSync(path.join(agentsDir, "moon-dev.md")).mtimeMs).toBe(before);

    const fm = matter(
      fs.readFileSync(path.join(vaultProjectsDir, "moon-phase-cli", "PROJECT.md"), "utf8")
    ).data;
    expect(fm.crew).toEqual(expect.arrayContaining(["moon-dev", "moon-reviewer"]));
  });

  it("fileIssues=false skips the issues step and files nothing", async () => {
    const { exec } = makeExec();
    const job = createJob({ ...INPUT, fileIssues: false });
    await runPipeline(job, makeDeps(exec));

    expect(job.status).toBe("succeeded");
    expect(job.steps.find((s) => s.id === "issues")!.status).toBe("skipped");
    expect(listIssues({ projectSlug: "moon-phase-cli" })).toHaveLength(0);
  });

  it("git commit failure fails the job at scaffold; register never runs", async () => {
    const { exec } = makeExec({ gitCommitFails: true });
    const job = createJob(INPUT);
    await runPipeline(job, makeDeps(exec));

    expect(job.status).toBe("failed");
    expect(job.steps.find((s) => s.id === "scaffold")!.status).toBe("failed");
    expect(job.steps.find((s) => s.id === "register")!.status).toBe("pending");
    // No rollback: the folder stays for inspection.
    expect(fs.existsSync(path.join(workspaceRoot, "moon-phase-cli"))).toBe(true);
    expect(fs.existsSync(path.join(vaultProjectsDir, "moon-phase-cli", "PROJECT.md"))).toBe(false);
  });

  it("covers every step id exactly once in CREATE_STEPS order", async () => {
    const { exec } = makeExec();
    const job = createJob(INPUT);
    await runPipeline(job, makeDeps(exec));
    expect(job.steps.map((s) => s.id)).toEqual([...CREATE_STEPS]);
  });
});
