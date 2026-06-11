import { getIssue, updateIssue } from "@/lib/issues";
import { getProject } from "@/lib/projects";
import { getAgent } from "@/lib/agents";
import { getRuntime } from "@/lib/runtime/registry";
import { assertCapacity } from "@/lib/runtime/concurrencyCap";
import { createRun, getRun, updateRun } from "@/lib/runs";
import { createWorktree, worktreePathFor } from "@/lib/worktrees";
import { registerLiveRun, dropLiveRun } from "@/lib/runtime/liveRuns";
import { getSettings } from "@/lib/settings";
import { publish } from "@/lib/stream";
import { appendEvent } from "@/lib/threads";
import { installWorktreeMcpConfig } from "@/lib/mcp";
import { readInstructions, knowledgeScopePrefix } from "@/lib/projectKnowledge";
import { retrieve } from "@/lib/rag/retrieval";
import { buildWorktreeContext, installWorktreeContext } from "@/lib/promptAssembly";

/** Pipeline failure with an HTTP-ish status the API route can map directly. */
export class StartRunError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "StartRunError";
  }
}

function publicBaseUrl(): string {
  return process.env.AGENTIC_OS_PUBLIC_URL ?? "http://localhost:3000";
}

/**
 * Persist a run's exit and transition its issue. Idempotent (guarded by
 * ended_at), because it is called from two places that can race: the PTY
 * onExit listener attached at spawn time (covers unattended autonomous runs)
 * and the WebSocket handler in server.ts (covers attended runs).
 */
export function finalizeRunExit(runId: number, exitCode: number, signal?: number): void {
  const run = getRun(runId);
  if (!run || run.endedAt != null) return;

  // Code 0 means "agent finished cleanly, operator should review"; anything
  // else (non-zero exit, killed by signal) is a failure the operator can retry.
  const cleanExit = exitCode === 0 && !signal;
  const exitStatus = cleanExit ? "done" : "failed";
  const newIssueStatus = cleanExit ? "review" : "failed";

  updateRun(runId, { endedAt: Date.now(), exitStatus });

  const issue = getIssue(run.issueId);
  if (issue) {
    updateIssue(issue.id, { status: newIssueStatus });
    appendEvent({
      projectSlug: issue.projectSlug,
      issueId: issue.id,
      eventType: `run.${exitStatus}`,
      details: `Run ${runId} exited with code ${exitCode}${signal ? ` (signal ${signal})` : ""}`,
    });
    publish({ kind: "issue.changed", id: issue.id, projectSlug: issue.projectSlug, reason: "status" });
    publish({ kind: "thread.appended", issueId: issue.id });
    publish({ kind: "run.finalized", runId, issueId: issue.id, projectSlug: issue.projectSlug, exitStatus });
  }
}

/**
 * The full run pipeline: resolve issue/project/agent/runtime, check capacity,
 * create the worktree and run row, spawn, register, flip the issue to
 * running. Extracted from POST /api/runs so the auto-router and scheduler
 * can start runs without an HTTP round-trip.
 */
export async function startRunForIssue(
  issueId: number,
  opts: { runtimeId?: string } = {}
): Promise<{ runId: number; worktreePath: string }> {
  const issue = getIssue(issueId);
  if (!issue) throw new StartRunError("issue not found", 404);
  if (!issue.assigneeSlug) throw new StartRunError("issue has no assignee", 400);

  const project = getProject(issue.projectSlug);
  if (!project) throw new StartRunError("project not found", 404);

  const agent = getAgent(issue.assigneeSlug);
  if (!agent) throw new StartRunError("assignee agent not found", 404);

  const runtimeId = opts.runtimeId ?? (agent.runtime || project["runtime-default"]);
  const runtime = getRuntime(runtimeId);
  if (!runtime) throw new StartRunError(`runtime not registered: ${runtimeId}`, 400);

  const settings = getSettings();
  // ConcurrencyCapError propagates as-is; callers treat it as "stay queued".
  assertCapacity({
    projectSlug: project.slug,
    perProjectMax: settings.concurrency.perProjectMax,
    globalMax: settings.concurrency.globalMax,
  });

  const worktreePath = worktreePathFor(settings.workspaceRoot, project.slug, issue.id);
  console.log(`[startRun] issue ${issue.id}: creating worktree at ${worktreePath} from ${project.path}`);
  try {
    createWorktree({
      sourceRepoPath: project.path,
      worktreePath,
      branchName: `agentic-os/issue-${issue.id}`,
    });
  } catch (err) {
    throw new StartRunError(`worktree creation failed: ${(err as Error).message}`, 500);
  }

  // Inject the project's MCP servers into the worktree before spawn. Claude
  // Code reads <worktree>/.mcp.json; Gemini reads ~/.gemini/settings.json
  // globally, so per-worktree injection only applies to claude-code.
  const mcpTemplates = project["mcp-servers"] ?? [];
  if (runtimeId === "claude-code" && mcpTemplates.length > 0) {
    try {
      const servers = installWorktreeMcpConfig(worktreePath, mcpTemplates);
      if (servers.length > 0) console.log(`[startRun] issue ${issue.id}: MCP servers ${servers.join(", ")}`);
    } catch (err) {
      // Non-fatal: the run proceeds without MCP tools.
      console.error(`[startRun] MCP install failed for issue ${issue.id}:`, err);
    }
  }

  // Project knowledge injection (spec 0014): instructions + top-k relevant
  // knowledge chunks land in <worktree>/AGENT_CONTEXT.md; the prompt gets one
  // pointer line. Non-fatal, same posture as the MCP install above.
  let contextPromptSuffix = "";
  try {
    const instructions = readInstructions(project.slug);
    const kn = await retrieve({
      q: `${issue.title}\n${issue.body}`.trim(),
      k: 5,
      scope: { pathPrefix: knowledgeScopePrefix(project.slug) },
    });
    const MIN_CHUNK_SCORE = 0.005; // drop weak matches; RRF scores are small
    const chunks = kn.chunks.filter((c) => c.score >= MIN_CHUNK_SCORE);
    if (instructions.trim() || chunks.length > 0 || agent.systemPrompt.trim()) {
      const parts = buildWorktreeContext({
        projectSlug: project.slug,
        issueTitle: issue.title,
        instructions,
        chunks,
        agentSystemPrompt: agent.systemPrompt,
      });
      installWorktreeContext(worktreePath, runtimeId, parts);
      contextPromptSuffix = parts.promptSuffix;
      console.log(`[startRun] issue ${issue.id}: AGENT_CONTEXT.md installed (${chunks.length} chunks)`);
    }
  } catch (err) {
    console.error(`[startRun] context install failed for issue ${issue.id}:`, err);
  }

  const runId = createRun({
    issueId: issue.id,
    agentSlug: agent.slug,
    runtimeId,
    worktreePath,
  });
  console.log(`[startRun] created run ${runId}; spawning ${runtimeId}`);

  let initialPrompt = `${issue.title}\n\n${issue.body}`.trim() + contextPromptSuffix;
  if (settings.autonomy.enabled) {
    initialPrompt += [
      "\n\nHandoff protocol: to delegate a follow-up task to another agent when you finish,",
      `POST ${publicBaseUrl()}/api/issues with JSON`,
      `{"projectSlug":"${project.slug}","title":"...","body":"...","parentIssueId":${issue.id},"status":"queued"}.`,
      "Only hand off work that genuinely needs another agent.",
    ].join(" ");
  }

  let spawned;
  try {
    spawned = await runtime.spawn({
      worktreePath,
      initialPrompt,
      runId,
      issueId: issue.id,
      projectSlug: project.slug,
    });
  } catch (err) {
    throw new StartRunError(`spawn failed: ${(err as Error).message}`, 500);
  }
  registerLiveRun(runId, spawned);

  // Persist exit at spawn time. Without this, a run nobody watches in a
  // browser would never transition its issue (the server.ts WS handler only
  // attaches once a terminal connects).
  spawned.pty.onExit(({ exitCode, signal }) => {
    console.log(`[startRun] run ${runId} exited: code=${exitCode}, signal=${signal ?? "none"}`);
    try {
      finalizeRunExit(runId, exitCode, signal);
    } catch (err) {
      console.error(`[startRun] finalize failed for run ${runId}:`, err);
    }
    dropLiveRun(runId);
  });
  console.log(`[startRun] spawn complete for run ${runId}, PTY pid=${spawned.pty.pid}`);

  updateIssue(issue.id, { status: "running" });
  appendEvent({
    projectSlug: project.slug,
    issueId: issue.id,
    eventType: "run.started",
    details: `Run ${runId} started against ${agent.slug} via ${runtimeId} at ${worktreePath}`,
  });
  publish({ kind: "issue.changed", id: issue.id, projectSlug: project.slug, reason: "status" });
  publish({ kind: "thread.appended", issueId: issue.id });

  return { runId, worktreePath };
}
