import { runClaude } from "@/lib/claude-headless";
import { finishRun, insertRun, updateRunUsage, type RunUsage } from "@/lib/db";
import { resolveMcpForServer, type McpResolution } from "@/lib/mcp-loader";
import { repoRoot } from "@/lib/paths";
import { projectBySlug } from "@/lib/projects-loader";
import { loadSkills } from "@/lib/skills-loader";
import { createTask } from "@/lib/tasks";
import path from "node:path";

export const dynamic = "force-dynamic";

type RunBody = {
  skillSlug?: string;
  userInput?: string;
  projectSlug?: string;
  prompt?: string;
  agent?: string;
  taskId?: number;
};

export async function POST(req: Request) {
  let body: RunBody;
  try {
    body = (await req.json()) as RunBody;
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }

  const { skillSlug, userInput, projectSlug, prompt: freeformPrompt, agent, taskId } = body;

  const skill = skillSlug
    ? loadSkills().find((s) => s.name === skillSlug)
    : null;
  if (skillSlug && !skill) {
    return Response.json({ error: "unknown skill" }, { status: 404 });
  }

  const project = projectSlug ? projectBySlug(projectSlug) : null;
  if (projectSlug && !project) {
    return Response.json({ error: "unknown project" }, { status: 404 });
  }
  if (project && !project.pathExists) {
    return Response.json(
      { error: `project path missing: ${project.path}` },
      { status: 412 }
    );
  }

  if (!skill && !freeformPrompt?.trim()) {
    return Response.json(
      { error: "either skillSlug or prompt required" },
      { status: 400 }
    );
  }

  const cwd = project?.path ?? repoRoot;
  const resolvedAgent = agent ?? skill?.agent ?? project?.agent ?? null;
  const prompt = buildPrompt({
    skillName: skill?.name ?? null,
    userInput: userInput ?? null,
    freeform: freeformPrompt ?? null,
    projectName: project?.name ?? null,
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
    projectSlug: project?.slug ?? null,
    cwd,
    agent: resolvedAgent,
    mcpServer: activeMcp?.name ?? null,
  });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };
      send({
        type: "started",
        runId,
        cwd,
        projectSlug: project?.slug ?? null,
        activeMcp,
        mcpStatus,
        requestedMcp: skill?.mcpServer ?? null,
      });
      let outputPath: string | null = null;
      let error: string | null = null;
      let usage: RunUsage = {};
      const extraEnv: Record<string, string> = {};
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
          extraEnv,
        })) {
          send(evt);
          if (evt.type === "done") outputPath = evt.data.outputPath;
          if (evt.type === "error") error = evt.data.message;
          if (evt.type === "usage") {
            usage = { ...usage, ...evt.data };
            updateRunUsage(runId, evt.data);
          }
          if (evt.type === "handoff") {
            if (skill?.handoff !== true) {
              send({ type: "delta", data: `[handoff dropped — skill ${skill?.name ?? "(adhoc)"} did not opt in via metadata.handoff: true]\n` });
              continue;
            }
            try {
              const childId = createTask({
                prompt: evt.data.prompt,
                assignee: evt.data.assignee,
                department: evt.data.assignee.startsWith("lead:") ? evt.data.assignee.slice(5) : null,
                parentTaskId: taskId ?? evt.data.parentTaskId ?? null,
              });
              send({ type: "delta", data: `[handoff → task ${childId} for ${evt.data.assignee}]\n` });
            } catch (e) {
              send({ type: "delta", data: `[handoff failed: ${e instanceof Error ? e.message : String(e)}]\n` });
            }
          }
        }
      } catch (e) {
        error = e instanceof Error ? e.message : String(e);
        send({ type: "error", data: { message: error } });
      } finally {
        finishRun(runId, error ? "error" : "done", outputPath, error, usage);
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
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
