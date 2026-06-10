import { NextResponse } from "next/server";
import { z } from "zod";
import { listAgents } from "@/lib/agents";
import { createAgent, AgentValidationError } from "@/lib/agentMutations";
import { ensureServerBooted } from "@/lib/server-init";

export async function GET() {
  const agents = listAgents().map(a => ({
    slug: a.slug,
    name: a.name,
    description: a.description ?? null,
    runtime: a.runtime,
    skills: a.skills,
    allowedTools: a["allowed-tools"],
    lastModified: a.lastModified,
  }));
  return NextResponse.json({ agents });
}

const CreateSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().optional(),
  runtime: z.string().min(1),
  skills: z.array(z.string()).default([]),
  allowedTools: z.array(z.string()).default([]),
  systemPrompt: z.string().min(1),
});

export async function POST(req: Request) {
  await ensureServerBooted();
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid request", issues: parsed.error.issues }, { status: 400 });
  }
  try {
    const agent = createAgent(parsed.data);
    // The agents/ chokidar watcher publishes agent.changed for SSE clients.
    return NextResponse.json({ slug: agent.slug }, { status: 201 });
  } catch (err) {
    if (err instanceof AgentValidationError) {
      return NextResponse.json({ error: err.message, errors: err.errors }, { status: 400 });
    }
    throw err;
  }
}
