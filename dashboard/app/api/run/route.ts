import { runClaude } from "@/lib/claude-headless";
import { finishRun, insertRun } from "@/lib/db";
import { loadSkills } from "@/lib/skills-loader";
import { repoRoot } from "@/lib/paths";

export const dynamic = "force-dynamic";

type RunBody = { skillSlug?: string; userInput?: string };

export async function POST(req: Request) {
  let body: RunBody;
  try {
    body = (await req.json()) as RunBody;
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }
  const { skillSlug, userInput } = body;
  if (!skillSlug) {
    return Response.json({ error: "missing skillSlug" }, { status: 400 });
  }
  const skill = loadSkills().find((s) => s.name === skillSlug);
  if (!skill) {
    return Response.json({ error: "unknown skill" }, { status: 404 });
  }

  const prompt = `Use the ${skill.name} skill.${userInput ? `\n\nInputs:\n${userInput}` : ""}`;
  const runId = insertRun(skill.name, prompt);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };
      send({ type: "started", runId });
      let outputPath: string | null = null;
      let error: string | null = null;
      try {
        for await (const evt of runClaude({ prompt, cwd: repoRoot })) {
          send(evt);
          if (evt.type === "done") outputPath = evt.data.outputPath;
          if (evt.type === "error") error = evt.data.message;
        }
      } catch (e) {
        error = e instanceof Error ? e.message : String(e);
        send({ type: "error", data: { message: error } });
      } finally {
        finishRun(runId, error ? "error" : "done", outputPath, error);
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
