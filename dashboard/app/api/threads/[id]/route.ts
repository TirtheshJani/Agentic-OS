import fs from "node:fs";
import path from "node:path";
import { threadsPath } from "@/lib/paths";
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
  if (!getTask(n)) return Response.json({ error: "task not found" }, { status: 404 });
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
  const line = `[${new Date().toISOString()}] user: ${body.body.replace(/\n/g, " ")}\n`;
  fs.appendFileSync(threadFileFor(n), line);
  return Response.json({ ok: true });
}
