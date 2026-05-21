import path from "node:path";
import { runClaude } from "@/lib/claude-headless";
import type { ClaudeEvent } from "@/lib/claude-headless";
import { finishRun, insertRun, updateRunUsage } from "@/lib/db";
import type { RunUsage } from "@/lib/db";
import { resolveMcpForServer } from "@/lib/mcp-loader";
import type { McpResolution } from "@/lib/mcp-loader";
import { repoRoot } from "@/lib/paths";
import { sharedVaultEnv, sharedVaultSystemPrompt } from "@/lib/shared-vault";
import { loadSkills } from "@/lib/skills-loader";
import type { Skill } from "@/lib/skills-loader";
import { createTask, finishTask, getTask, startTask } from "@/lib/tasks";
import { teamBySlug } from "@/lib/teams";
import type { Team } from "@/lib/teams";

/**
 * Inputs accepted by executeRun. Mirrors the /api/run POST body. The route
 * handler parses JSON then calls executeRun with the same shape so we have
 * one source of validation truth.
 */
export interface RunExecutionInput {
  skillSlug?: string;
  userInput?: string;
  projectSlug?: string;
  teamSlug?: string;
  prompt?: string;
  agent?: string;
  taskId?: number;
}

/**
 * Streamed event types emitted via onEvent. The "started" event is dashboard
 * specific (carries cwd / mcp metadata for the client); the remainder are
 * runClaude events forwarded verbatim. Keeping the shape concrete lets the
 * route handler turn each event into an SSE frame with no remapping.
 */
export type RunExecutionEvent =
  | {
      type: "started";
      runId: number;
      cwd: string;
      projectSlug: string | null;
      teamSlug: string | null;
      teamSource: string | null;
      activeMcp: { name: string; source: string } | null;
      mcpStatus: "ready" | "cloud-only" | "not-found" | null;
      requestedMcp: string | null;
    }
  | ClaudeEvent;

/** Validation errors returned to the route handler (which maps to HTTP). */
export type RunExecutionError =
  | { kind: "unknown-skill" }
  | { kind: "unknown-team" }
  | { kind: "team-path-missing"; path: string }
  | { kind: "missing-prompt" };

export interface RunExecutionOptions {
  /** Aborts the underlying claude subprocess via runClaude's signal hook. */
  signal?: AbortSignal;
  /** Fired for each streamed event. Synchronous; throw-safe consumers only. */
  onEvent?: (event: RunExecutionEvent) => void;
}

export interface RunExecutionResult {
  runId: number;
  /** "done" if the subprocess exited cleanly; "error" if it failed. */
  status: "done" | "error";
  /** Last write-target detected in claude output, if any. */
  outputPath: string | null;
  /** Final error message (subprocess error or thrown during streaming). */
  error: string | null;
}

/**
 * Validate the request shape and resolve heavy references (skill, team).
 * Returning the discriminated union here keeps validation in one place so
 * both the HTTP route and the in-process task-runner share behaviour.
 */
export function validateRunInput(
  input: RunExecutionInput
):
  | { ok: true; data: ResolvedRunInput }
  | { ok: false; error: RunExecutionError } {
  const skill = input.skillSlug
    ? loadSkills().find((s) => s.name === input.skillSlug)
    : null;
  if (input.skillSlug && !skill) {
    return { ok: false, error: { kind: "unknown-skill" } };
  }

  const targetSlug = input.teamSlug ?? input.projectSlug ?? null;
  const team = targetSlug ? teamBySlug(targetSlug) : null;
  if (targetSlug && !team) {
    return { ok: false, error: { kind: "unknown-team" } };
  }
  if (team && !team.pathExists) {
    return { ok: false, error: { kind: "team-path-missing", path: team.path } };
  }

  if (!skill && !input.prompt?.trim()) {
    return { ok: false, error: { kind: "missing-prompt" } };
  }

  return {
    ok: true,
    data: {
      skill: skill ?? null,
      team: team ?? null,
      userInput: input.userInput ?? null,
      freeformPrompt: input.prompt ?? null,
      agent: input.agent ?? null,
      taskId: input.taskId ?? null,
    },
  };
}

interface ResolvedRunInput {
  skill: Skill | null;
  team: Team | null;
  userInput: string | null;
  freeformPrompt: string | null;
  agent: string | null;
  taskId: number | null;
}

/**
 * Spawn a claude subprocess and stream its events to the caller.
 *
 * Shared by /api/run (SSE) and the in-process task-runner. The route handler
 * formats each event as `data: <json>\n\n`; task-runner ignores them.
 * Cancellation is via options.signal -> runClaude's AbortSignal -> child.kill.
 *
 * On validation failure (unknown skill, missing prompt, etc.) this throws so
 * the route handler can map to HTTP status codes. Callers that want non
 * throwing validation should call validateRunInput directly.
 */
export async function executeRun(
  input: RunExecutionInput,
  options: RunExecutionOptions = {}
): Promise<RunExecutionResult> {
  const validation = validateRunInput(input);
  if (!validation.ok) {
    throw new RunValidationError(validation.error);
  }
  const { skill, team, userInput, freeformPrompt, agent, taskId } =
    validation.data;

  const cwd = team?.path ?? repoRoot;
  const resolvedAgent = agent ?? skill?.agent ?? team?.agent ?? null;
  const prompt = buildPrompt({
    skillName: skill?.name ?? null,
    userInput,
    freeform: freeformPrompt,
    projectName: team?.name ?? null,
  });

  const mcpResolution: McpResolution | null = skill?.mcpServer
    ? resolveMcpForServer(skill.mcpServer)
    : null;
  const activeMcp =
    mcpResolution && mcpResolution.kind === "ready"
      ? { name: mcpResolution.serverName, source: mcpResolution.source }
      : null;
  const mcpStatus: "ready" | "cloud-only" | "not-found" | null = mcpResolution
    ? mcpResolution.kind
    : null;

  const runId = insertRun({
    skillSlug: skill?.name ?? "(adhoc)",
    prompt,
    projectSlug: team?.slug ?? null,
    cwd,
    agent: resolvedAgent,
    mcpServer: activeMcp?.name ?? null,
  });

  if (taskId) {
    try {
      startTask(taskId, runId);
    } catch (e) {
      // State machine rejected (task already running/done/etc). Run still
      // proceeds; the task->run link will just be missing.
      console.error(
        `[run] startTask(${taskId}) rejected: ${
          e instanceof Error ? e.message : String(e)
        }`
      );
    }
  }

  const emit = (event: RunExecutionEvent) => {
    if (!options.onEvent) return;
    try {
      options.onEvent(event);
    } catch (e) {
      // Consumer-side error in onEvent must not corrupt the run. Log and
      // continue draining the subprocess so finishRun still fires.
      console.error(
        `[run] onEvent threw: ${e instanceof Error ? e.message : String(e)}`
      );
    }
  };

  emit({
    type: "started",
    runId,
    cwd,
    projectSlug: team?.slug ?? null,
    teamSlug: team?.slug ?? null,
    teamSource: team?.source ?? null,
    activeMcp,
    mcpStatus,
    requestedMcp: skill?.mcpServer ?? null,
  });

  let outputPath: string | null = null;
  let error: string | null = null;
  let usage: RunUsage = {};
  const extraEnv: Record<string, string> = {
    ...sharedVaultEnv(team?.slug ?? null),
  };
  if (taskId) {
    const threadFile = path.join(repoRoot, "vault", "threads", `${taskId}.md`);
    extraEnv.AGENTIC_OS_THREAD_PATH = threadFile;
  }

  try {
    for await (const evt of runClaude({
      prompt,
      cwd,
      mcpConfigPath:
        mcpResolution?.kind === "ready" ? mcpResolution.tmpConfigPath : undefined,
      appendSystemPrompt: sharedVaultSystemPrompt(team?.slug ?? null),
      extraEnv,
      signal: options.signal,
    })) {
      emit(evt);
      if (evt.type === "done") outputPath = evt.data.outputPath;
      if (evt.type === "error") error = evt.data.message;
      if (evt.type === "usage") {
        usage = { ...usage, ...evt.data };
        updateRunUsage(runId, evt.data);
      }
      if (evt.type === "handoff") {
        const trustedByAgent = typeof agent === "string" && agent.length > 0;
        if (skill?.handoff !== true && !trustedByAgent) {
          emit({
            type: "delta",
            data: `[handoff dropped: skill ${
              skill?.name ?? "(adhoc)"
            } did not opt in via metadata.handoff: true]\n`,
          });
          continue;
        }
        try {
          // Phase 7.3: child task inherits parent's project_slug unless the
          // handoff payload explicitly overrides it.
          const parentTaskId = taskId ?? evt.data.parentTaskId ?? null;
          let childProjectSlug: string | null = null;
          if (evt.data.projectSlug !== undefined) {
            childProjectSlug = evt.data.projectSlug;
          } else if (parentTaskId != null) {
            const parent = getTask(parentTaskId);
            if (parent?.project_slug) {
              childProjectSlug = parent.project_slug;
              console.log(
                `[run] handoff inheriting project_slug=${childProjectSlug} from parent task ${parentTaskId}`
              );
            }
          }
          const childId = createTask({
            prompt: evt.data.prompt,
            assignee: evt.data.assignee,
            department: evt.data.assignee.startsWith("lead:")
              ? evt.data.assignee.slice(5)
              : null,
            parentTaskId,
            projectSlug: childProjectSlug,
          });
          emit({
            type: "delta",
            data: `[handoff -> task ${childId} for ${evt.data.assignee}]\n`,
          });
          const child = getTask(childId);
          if (child) {
            // Dynamic import avoids the run-execution <-> task-runner cycle
            // (task-runner imports executeRun for the named-agent spawn path).
            const { spawnTaskIfNamed } = await import("@/lib/task-runner");
            spawnTaskIfNamed(child);
          }
        } catch (e) {
          emit({
            type: "delta",
            data: `[handoff failed: ${
              e instanceof Error ? e.message : String(e)
            }]\n`,
          });
        }
      }
    }
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
    emit({ type: "error", data: { message: error } });
  } finally {
    finishRun(runId, error ? "error" : "done", outputPath, error, usage);
    if (taskId) {
      try {
        finishTask(taskId, error ? "failed" : "done", error);
      } catch (e) {
        console.error(
          `[run] finishTask(${taskId}) rejected: ${
            e instanceof Error ? e.message : String(e)
          }`
        );
      }
    }
  }

  return {
    runId,
    status: error ? "error" : "done",
    outputPath,
    error,
  };
}

/**
 * Thrown by executeRun on input validation failure. The route handler maps
 * the `.error` discriminant to an HTTP status; in-process callers can just
 * surface the message.
 */
export class RunValidationError extends Error {
  constructor(public readonly error: RunExecutionError) {
    super(describeValidationError(error));
    this.name = "RunValidationError";
  }
}

function describeValidationError(error: RunExecutionError): string {
  switch (error.kind) {
    case "unknown-skill":
      return "unknown skill";
    case "unknown-team":
      return "unknown team";
    case "team-path-missing":
      return `team path missing: ${error.path}`;
    case "missing-prompt":
      return "either skillSlug or prompt required";
  }
}

function buildPrompt(opts: {
  skillName: string | null;
  userInput: string | null;
  freeform: string | null;
  projectName: string | null;
}): string {
  const parts: string[] = [];
  if (opts.projectName) {
    parts.push(`Working in project "${opts.projectName}".`);
  }
  if (opts.skillName) {
    parts.push(`Use the ${opts.skillName} skill.`);
  }
  if (opts.userInput) {
    parts.push(`Inputs:\n${opts.userInput}`);
  }
  if (opts.freeform) {
    parts.push(opts.freeform);
  }
  return parts.join("\n\n");
}
