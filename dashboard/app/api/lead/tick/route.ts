import { runClaude } from "@/lib/claude-headless";
import { finishRun, insertRun, type RunUsage } from "@/lib/db";
import { listTasks } from "@/lib/tasks";
import { repoRoot } from "@/lib/paths";
import { loadAgents, leadFor, isDepartment } from "@/lib/agents-loader";
import { loadSkills } from "@/lib/skills-loader";
import path from "node:path";
import fs from "node:fs";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { department?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }
  if (!body.department || !isDepartment(body.department)) {
    return Response.json({ error: "department required (research|coding|content|business|productivity)" }, { status: 400 });
  }

  const dept = body.department;
  const agents = loadAgents();
  const lead = leadFor(dept, agents);
  if (!lead) {
    return Response.json({ error: `no lead authored for department ${dept}` }, { status: 404 });
  }

  const skills = loadSkills();
  const leadSkill = skills.find((s) => s.name === lead.name);
  if (!leadSkill) {
    return Response.json({ error: `lead agent ${lead.name} has no matching skill in skills/` }, { status: 404 });
  }

  const queueAssignee = `lead:${dept}`;
  const queued = listTasks({ assignee: queueAssignee, status: "queued", limit: 50 });

  const queueJson = JSON.stringify({
    tick_at: new Date().toISOString(),
    department: dept,
    pending: queued.map((t) => ({
      id: t.id,
      prompt: t.prompt,
      created_at: t.created_at,
      department: t.department,
    })),
  }, null, 2);

  const prompt = `Use the ${lead.name} skill.\n\nQueue:\n${queueJson}`;

  let appendSystemPrompt: string | undefined;
  if (lead.systemPromptPath) {
    const resolved = path.resolve(repoRoot, "agents", lead.folder, lead.systemPromptPath);
    if (fs.existsSync(resolved)) {
      appendSystemPrompt = fs.readFileSync(resolved, "utf8");
    }
  }

  const runId = insertRun({
    skillSlug: lead.name,
    prompt,
    agent: lead.name,
  });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };
      send({ type: "started", runId, department: dept, queueDepth: queued.length });
      let error: string | null = null;
      const usage: RunUsage = {};
      try {
        for await (const evt of runClaude({
          prompt,
          cwd: repoRoot,
          appendSystemPrompt,
        })) {
          send(evt);
          if (evt.type === "error") error = evt.data.message;
        }
      } catch (e) {
        error = e instanceof Error ? e.message : String(e);
        send({ type: "error", data: { message: error } });
      } finally {
        finishRun(runId, error ? "error" : "done", null, error, usage);
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
