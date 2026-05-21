import { agentByName } from "@/lib/agents-loader";
import { launch } from "@/lib/claude-launcher";
import { getTask } from "@/lib/tasks";

export const dynamic = "force-dynamic";

type Body = {
  agent?: string;
  taskId?: number;
};

// Phase 8.4: spawns an interactive `claude` session in the agent's
// default-repo directory with the task body as the opening prompt. Inserts
// a 'terminal'-sourced runs row up front; the row stays 'running' until a
// 24h GC pass cancels it (out of scope).
export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }

  const agentName = typeof body.agent === "string" ? body.agent : null;
  if (!agentName) {
    return Response.json({ error: "agent required" }, { status: 400 });
  }
  const agent = agentByName(agentName);
  if (!agent) {
    return Response.json({ error: `unknown agent: ${agentName}` }, { status: 404 });
  }
  if (!agent.defaultRepo) {
    return Response.json(
      { error: `agent "${agentName}" has no default-repo configured` },
      { status: 412 }
    );
  }

  let prompt = "";
  let taskId: number | null = null;
  if (typeof body.taskId === "number") {
    const task = getTask(body.taskId);
    if (!task) {
      return Response.json({ error: `unknown task: ${body.taskId}` }, { status: 404 });
    }
    prompt = task.prompt;
    taskId = task.id;
  }

  const result = await launch({
    mode: "terminal",
    cwd: agent.defaultRepo,
    prompt,
    agent: agentName,
    taskId,
  });
  if ("error" in result) {
    return Response.json({ error: result.error }, { status: 500 });
  }
  return Response.json({ runId: result.runId });
}
