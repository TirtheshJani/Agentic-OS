// dashboard/lib/createProject/pipeline.ts
// Deterministic create-project pipeline. Exactly one LLM call (the draft
// step); everything else is plain TypeScript. No rollback on failure:
// completed artifacts stay and the job result reports what exists.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { listSkills } from "@/lib/skills";
import { listRuntimes } from "@/lib/runtime/registry";
import { createAgent, AgentValidationError } from "@/lib/agentMutations";
import { createIssue } from "@/lib/issues";
import {
  slugify,
  createProjectFromExistingFolder,
  updateProjectCrew,
} from "@/lib/projectMutations";
import { publish } from "@/lib/stream";
import { AGENTS_DIR, VAULT_PROJECTS_DIR } from "@/lib/paths";
import { getSettings } from "@/lib/settings";
import {
  buildOrchestratorPrompt,
  parseOrchestratorDraft,
  runOrchestratorDraft,
  sanitizeDraft,
  type OrchestratorDraft,
} from "@/lib/createProject/draft";
import { runPreflight } from "@/lib/createProject/preflight";
import {
  createJob,
  finishJob,
  getActiveJob,
  updateStep,
  type CreateJob,
  type CreateJobInput,
} from "@/lib/createProject/jobs";

export interface ExecResult {
  ok: boolean;
  status: number | null;
  stdout: string;
  stderr: string;
}

export type ExecFn = (
  cmd: string,
  args: string[],
  opts?: { cwd?: string; timeoutMs?: number }
) => ExecResult;

export function defaultExec(
  cmd: string,
  args: string[],
  opts: { cwd?: string; timeoutMs?: number } = {}
): ExecResult {
  // No shell: git and gh are real .exe binaries that spawnSync resolves via
  // PATH, and shell:true would concatenate args unquoted on Windows,
  // splitting values like a commit message at the first space.
  const r = spawnSync(cmd, args, {
    cwd: opts.cwd,
    encoding: "utf8",
    timeout: opts.timeoutMs ?? 120_000,
    maxBuffer: 8 * 1024 * 1024,
  });
  return {
    ok: r.status === 0 && !r.error,
    status: r.status,
    stdout: r.stdout ?? "",
    stderr: r.error ? String(r.error.message) : r.stderr ?? "",
  };
}

export interface PipelineDeps {
  exec: ExecFn;
  runDraft: typeof runOrchestratorDraft;
  preflight: typeof runPreflight;
  workspaceRoot: string;
  vaultProjectsDir: string;
  agentsDir: string;
  /** Skills root override for agent validation (tests). */
  skillsRootDir?: string;
}

function resolveDeps(overrides: Partial<PipelineDeps> = {}): PipelineDeps {
  return {
    exec: overrides.exec ?? defaultExec,
    runDraft: overrides.runDraft ?? runOrchestratorDraft,
    preflight: overrides.preflight ?? runPreflight,
    workspaceRoot: overrides.workspaceRoot ?? getSettings().workspaceRoot,
    vaultProjectsDir: overrides.vaultProjectsDir ?? VAULT_PROJECTS_DIR,
    agentsDir: overrides.agentsDir ?? AGENTS_DIR,
    skillsRootDir: overrides.skillsRootDir,
  };
}

export function startCreateProjectJob(
  input: CreateJobInput,
  depOverrides: Partial<PipelineDeps> = {}
): { job: CreateJob } | { error: "busy"; jobId: string } {
  const active = getActiveJob();
  if (active) return { error: "busy", jobId: active.id };
  const job = createJob(input);
  const deps = resolveDeps(depOverrides);
  // Fire and forget; the route returns immediately and progress flows over SSE.
  void runPipeline(job, deps).catch((err) => {
    console.error(`[createProject] pipeline crashed:`, err);
    finishJob(job.id, "failed");
  });
  return { job };
}

/** First slug (base, base-2, base-3...) free in BOTH vault and workspace. */
export function resolveProjectSlug(
  base: string,
  opts: { vaultProjectsDir: string; workspaceRoot: string }
): string {
  const taken = (slug: string) =>
    fs.existsSync(path.join(opts.vaultProjectsDir, slug, "PROJECT.md")) ||
    fs.existsSync(path.join(opts.workspaceRoot, slug));
  if (!taken(base)) return base;
  for (let i = 2; i < 100; i++) {
    const candidate = `${base}-${i}`;
    if (!taken(candidate)) return candidate;
  }
  throw new Error(`could not find a free slug for ${base}`);
}

function fail(job: CreateJob, step: Parameters<typeof updateStep>[1], error: string): void {
  updateStep(job.id, step, { status: "failed", error });
  finishJob(job.id, "failed");
}

export async function runPipeline(job: CreateJob, deps: PipelineDeps): Promise<void> {
  const { input } = job;
  const wantRepo = input.visibility !== "local-only";

  // 1. preflight - cheap checks before the draft credit is spent.
  updateStep(job.id, "preflight", { status: "running" });
  const pre = await deps.preflight({
    wantRepo,
    workspaceRoot: deps.workspaceRoot,
    vaultProjectsDir: deps.vaultProjectsDir,
  });
  job.result.warnings.push(...pre.warnings);
  if (!pre.ok) {
    fail(job, "preflight", pre.failures.join("; "));
    return;
  }
  updateStep(job.id, "preflight", { status: "done", detail: "claude/gh/folders OK" });

  // 2. draft - the one headless claude call.
  updateStep(job.id, "draft", { status: "running", detail: "one headless Claude call" });
  const skillNames = listSkills(deps.skillsRootDir).map((s) => s.name);
  const runtimeIds = listRuntimes().map((r) => r.id);
  const prompt = buildOrchestratorPrompt(input.prompt, skillNames, runtimeIds);
  const draftRun = deps.runDraft(prompt);
  if (!draftRun.ok) {
    fail(job, "draft", draftRun.error);
    return;
  }
  const parsed = parseOrchestratorDraft(draftRun.raw);
  if (!parsed.ok) {
    fail(job, "draft", `${parsed.error}: ${parsed.raw.slice(0, 300)}`);
    return;
  }
  const { draft, warnings } = sanitizeDraft(
    parsed.draft,
    new Set(skillNames),
    new Set(runtimeIds),
    input.runtimeDefault
  );
  job.result.warnings.push(...warnings);
  updateStep(job.id, "draft", {
    status: "done",
    detail: `"${draft.project.name}": ${draft.team.length} agents, ${draft.seedIssues.length} issues`,
  });

  // 3. resolve - final slug + which agents already exist.
  updateStep(job.id, "resolve", { status: "running" });
  const slug = resolveProjectSlug(slugify(draft.project.slug || draft.project.name), {
    vaultProjectsDir: deps.vaultProjectsDir,
    workspaceRoot: deps.workspaceRoot,
  });
  const targetDir = path.join(deps.workspaceRoot, slug);
  const reused: OrchestratorDraft["team"] = [];
  const toCreate: OrchestratorDraft["team"] = [];
  for (const member of draft.team) {
    if (fs.existsSync(path.join(deps.agentsDir, `${member.slug}.md`))) {
      reused.push(member);
      job.result.warnings.push(`agent ${member.slug} already exists; reusing it`);
    } else {
      toCreate.push(member);
    }
  }
  job.result.projectSlug = slug;
  job.result.projectPath = targetDir;
  updateStep(job.id, "resolve", { status: "done", detail: `${slug} -> ${targetDir}` });

  // 4. scaffold - local folder, seed files, git init + first commit.
  updateStep(job.id, "scaffold", { status: "running" });
  try {
    fs.mkdirSync(targetDir, { recursive: false });
  } catch (err) {
    fail(job, "scaffold", `could not create ${targetDir}: ${String(err)}`);
    return;
  }
  const description = draft.project.description.trim();
  fs.writeFileSync(
    path.join(targetDir, "README.md"),
    `# ${draft.project.name}\n\n${description || "Scaffolded by Agentic OS."}\n`
  );
  fs.writeFileSync(
    path.join(targetDir, ".gitignore"),
    ["node_modules/", "dist/", ".env", ".env.*", "*.log", ".DS_Store", ""].join("\n")
  );
  fs.writeFileSync(
    path.join(targetDir, "CLAUDE.md"),
    `# ${draft.project.name}\n\n${description}\n\n## Conventions\n\n(Authored by the crew as the project takes shape.)\n`
  );
  for (const [cmd, args] of [
    ["git", ["init", "-b", "main"]],
    ["git", ["add", "-A"]],
    ["git", ["commit", "-m", `chore: scaffold ${slug} via Agentic OS`]],
  ] as const) {
    const r = deps.exec(cmd, [...args], { cwd: targetDir });
    if (!r.ok) {
      fail(job, "scaffold", `${cmd} ${args[0]} failed: ${r.stderr || r.stdout}`.slice(0, 500));
      return;
    }
  }
  updateStep(job.id, "scaffold", { status: "done", detail: "git repo with initial commit" });

  // 5. github - create + push, or degrade to local-only with a warning.
  if (!wantRepo) {
    updateStep(job.id, "github", { status: "skipped", detail: "local-only requested" });
  } else {
    updateStep(job.id, "github", { status: "running" });
    const shortDesc = description.replace(/[\r\n"]+/g, " ").trim().slice(0, 200);
    const r = deps.exec(
      "gh",
      [
        "repo",
        "create",
        slug,
        input.visibility === "public" ? "--public" : "--private",
        "--source",
        ".",
        "--remote",
        "origin",
        "--push",
        ...(shortDesc ? ["-d", shortDesc] : []),
      ],
      { cwd: targetDir, timeoutMs: 180_000 }
    );
    if (r.ok) {
      const url = (r.stdout + r.stderr).match(/https:\/\/github\.com\/\S+/)?.[0] ?? null;
      job.result.repoUrl = url?.replace(/\.git$/, "") ?? null;
      updateStep(job.id, "github", { status: "done", detail: job.result.repoUrl ?? "created" });
    } else {
      const recover = `gh repo create ${slug} --private --source . --remote origin --push`;
      job.result.warnings.push(
        `GitHub repo creation failed; project is local-only. Create it later from ${targetDir} with: ${recover}`
      );
      updateStep(job.id, "github", {
        status: "warning",
        error: (r.stderr || r.stdout).slice(0, 300),
        detail: "continuing local-only",
      });
    }
  }

  // 6. register - vault PROJECT.md (repo: auto-read from origin remote).
  updateStep(job.id, "register", { status: "running" });
  let projectFilePath: string;
  try {
    const created = createProjectFromExistingFolder({
      name: draft.project.name,
      folderPath: targetDir,
      vaultProjectsDir: deps.vaultProjectsDir,
      slug,
      capabilities: draft.project.capabilities,
      description: description || undefined,
      runtimeDefault: input.runtimeDefault,
    });
    projectFilePath = created.projectFilePath;
  } catch (err) {
    fail(job, "register", String(err).slice(0, 500));
    return;
  }
  job.result.projectFilePath = projectFilePath;
  publish({ kind: "project.changed", slug, reason: "create" });
  updateStep(job.id, "register", { status: "done", detail: `vault/projects/${slug}/PROJECT.md` });

  // 7. agents - create the crew (skip individual failures, never abort).
  updateStep(job.id, "agents", { status: "running" });
  for (const member of toCreate) {
    try {
      createAgent(
        {
          name: member.slug,
          slug: member.slug,
          description: member.description,
          runtime: member.runtime,
          skills: member.skills,
          allowedTools: member.allowedTools,
          systemPrompt: member.systemPrompt,
        },
        { rootDir: deps.agentsDir, skillsRootDir: deps.skillsRootDir }
      );
      job.result.agentsCreated.push(member.slug);
      publish({ kind: "agent.changed", slug: member.slug, reason: "create" });
    } catch (err) {
      const detail = err instanceof AgentValidationError ? err.message : String(err);
      job.result.warnings.push(`agent ${member.slug} skipped: ${detail}`);
    }
  }
  job.result.agentsReused = reused.map((m) => m.slug);
  const crew = [...job.result.agentsCreated, ...job.result.agentsReused];
  updateProjectCrew(projectFilePath, crew);
  updateStep(job.id, "agents", {
    status: "done",
    detail: `${job.result.agentsCreated.length} created, ${reused.length} reused`,
  });

  // 8. issues - kickoff backlog (safe: auto-router only acts on "queued").
  if (!input.fileIssues) {
    updateStep(job.id, "issues", { status: "skipped", detail: "kickoff issues disabled" });
  } else {
    updateStep(job.id, "issues", { status: "running" });
    for (const seed of draft.seedIssues) {
      const id = createIssue({
        projectSlug: slug,
        title: seed.title,
        body: seed.body,
        status: "backlog",
      });
      job.result.issueIds.push(id);
      publish({ kind: "issue.changed", id, projectSlug: slug, reason: "create" });
    }
    updateStep(job.id, "issues", {
      status: "done",
      detail: `${job.result.issueIds.length} backlog issues`,
    });
  }

  finishJob(job.id, "succeeded");
}
