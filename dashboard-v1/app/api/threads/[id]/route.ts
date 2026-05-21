import fs from "node:fs";
import path from "node:path";
import { commentOnIssue } from "@/lib/github-sync";
import { threadsPath } from "@/lib/paths";
import { projectBySlug } from "@/lib/projects-loader";
import { getTask } from "@/lib/tasks";

export const dynamic = "force-dynamic";

function threadFileFor(id: number): string {
  return path.join(threadsPath, `${id}.md`);
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const n = Number(id);
  if (!Number.isFinite(n) || n <= 0) {
    return Response.json({ error: "invalid id" }, { status: 400 });
  }
  if (!getTask(n)) return Response.json({ error: "task not found" }, { status: 404 });
  const file = threadFileFor(n);
  const content = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  return Response.json({ content });
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const n = Number(id);
  if (!Number.isFinite(n) || n <= 0) {
    return Response.json({ error: "invalid id" }, { status: 400 });
  }
  const task = getTask(n);
  if (!task) return Response.json({ error: "task not found" }, { status: 404 });
  let body: { body?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }
  if (!body.body || typeof body.body !== "string") {
    return Response.json({ error: "body required" }, { status: 400 });
  }
  if (body.body.length > 8000) {
    return Response.json({ error: "body too long" }, { status: 413 });
  }
  fs.mkdirSync(threadsPath, { recursive: true });
  const file = threadFileFor(n);
  const commentBody = body.body;
  const line = `[${new Date().toISOString()}] user: ${commentBody.replace(/\n/g, " ")}\n`;
  fs.appendFileSync(file, line);

  // Phase 8.5 write-back: mirror this user comment to the underlying
  // GitHub issue when the project is in `write-back` mode and the task
  // is GitHub-linked. Failures are logged to the thread but never
  // surface as 4xx/5xx — the local append already succeeded.
  if (task.repo && task.github_number && task.project_slug) {
    const project = projectBySlug(task.project_slug);
    if (project?.githubSync === "write-back") {
      void (async () => {
        const r = await commentOnIssue(task.repo!, task.github_number!, commentBody);
        if (!r.ok) {
          fs.appendFileSync(
            file,
            `[${new Date().toISOString()}] system: gh issue comment failed for ${task.repo}#${task.github_number}: ${r.error.replace(/\n/g, " ")}\n`
          );
        }
      })();
    }
  }
  return Response.json({ ok: true });
}
