import { NextResponse } from "next/server";
import { z } from "zod";
import { getIssue, updateIssue } from "@/lib/issues";
import { getProject } from "@/lib/projects";
import { getAgent } from "@/lib/agents";
import { getRuntime } from "@/lib/runtime/registry";
import { assertCapacity } from "@/lib/runtime/concurrencyCap";
import { createRun, listRuns } from "@/lib/runs";
import { createWorktree, worktreePathFor } from "@/lib/worktrees";
import { registerLiveRun } from "@/lib/runtime/liveRuns";
import { getSettings } from "@/lib/settings";
import { openDb } from "@/lib/db";
import { ensureServerBooted } from "@/lib/server-init";
import { publish } from "@/lib/stream";
import { appendEvent } from "@/lib/threads";
import { ConcurrencyCapError } from "@/lib/runtime/types";

openDb();

const PostSchema = z.object({
  issueId: z.number().int().positive(),
  /** Per-run override; falls back to the agent's runtime, then the project default. */
  runtimeId: z.string().min(1).optional(),
});

export async function POST(req: Request) {
  await ensureServerBooted();

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid JSON" }, { status: 400 }); }
  const parsed = PostSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid request" }, { status: 400 });

  console.log(`[runs.POST] issueId=${parsed.data.issueId}`);

  const issue = getIssue(parsed.data.issueId);
  if (!issue) return NextResponse.json({ error: "issue not found" }, { status: 404 });
  if (!issue.assigneeSlug) return NextResponse.json({ error: "issue has no assignee" }, { status: 400 });

  const project = getProject(issue.projectSlug);
  if (!project) return NextResponse.json({ error: "project not found" }, { status: 404 });

  const agent = getAgent(issue.assigneeSlug);
  if (!agent) return NextResponse.json({ error: "assignee agent not found" }, { status: 404 });

  const runtimeId = parsed.data.runtimeId ?? (agent.runtime || project["runtime-default"]);
  const runtime = getRuntime(runtimeId);
  if (!runtime) return NextResponse.json({ error: `runtime not registered: ${runtimeId}` }, { status: 400 });

  const settings = getSettings();
  try {
    assertCapacity({
      projectSlug: project.slug,
      perProjectMax: settings.concurrency.perProjectMax,
      globalMax: settings.concurrency.globalMax,
    });
  } catch (err) {
    if (err instanceof ConcurrencyCapError) {
      console.log(`[runs.POST] cap hit: ${err.scope} ${err.active}/${err.cap}`);
      return NextResponse.json(
        { error: err.message, scope: err.scope, cap: err.cap, active: err.active },
        { status: 429 }
      );
    }
    throw err;
  }

  const worktreePath = worktreePathFor(settings.workspaceRoot, project.slug, issue.id);
  console.log(`[runs.POST] creating worktree at ${worktreePath} from ${project.path}`);
  try {
    createWorktree({
      sourceRepoPath: project.path,
      worktreePath,
      branchName: `agentic-os/issue-${issue.id}`,
    });
  } catch (err) {
    console.error(`[runs.POST] worktree creation failed:`, err);
    return NextResponse.json({ error: `worktree creation failed: ${(err as Error).message}` }, { status: 500 });
  }

  const runId = createRun({
    issueId: issue.id,
    agentSlug: agent.slug,
    runtimeId,
    worktreePath,
  });
  console.log(`[runs.POST] created run ${runId}; spawning ${runtimeId}`);

  try {
    const spawned = await runtime.spawn({
      worktreePath,
      initialPrompt: `${issue.title}\n\n${issue.body}`.trim(),
      runId,
      issueId: issue.id,
      projectSlug: project.slug,
    });
    registerLiveRun(runId, spawned);
    console.log(`[runs.POST] spawn complete for run ${runId}, PTY pid=${spawned.pty.pid}`);
  } catch (err) {
    console.error(`[runs.POST] spawn failed for run ${runId}:`, err);
    return NextResponse.json({ error: `spawn failed: ${(err as Error).message}` }, { status: 500 });
  }

  updateIssue(issue.id, { status: "running" });
  appendEvent({
    projectSlug: project.slug,
    issueId: issue.id,
    eventType: "run.started",
    details: `Run ${runId} started against ${agent.slug} via ${runtimeId} at ${worktreePath}`,
  });
  publish({ kind: "issue.changed", id: issue.id, projectSlug: project.slug, reason: "status" });
  publish({ kind: "thread.appended", issueId: issue.id });

  return NextResponse.json({ runId, worktreePath }, { status: 201 });
}

export async function GET(req: Request) {
  await ensureServerBooted();
  const { searchParams } = new URL(req.url);
  const issueIdParam = searchParams.get("issueId");
  if (!issueIdParam) return NextResponse.json({ error: "issueId required" }, { status: 400 });
  const issueId = parseInt(issueIdParam, 10);
  return NextResponse.json({ runs: listRuns({ issueId }) });
}
