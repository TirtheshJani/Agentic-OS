import { NextResponse } from "next/server";
import { z } from "zod";
import { getAgent } from "@/lib/agents";
import { updateAgent, archiveAgent, AgentValidationError } from "@/lib/agentMutations";
import { ensureServerBooted } from "@/lib/server-init";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const agent = getAgent(slug);
  if (!agent) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({
    slug: agent.slug,
    name: agent.name,
    description: agent.description ?? null,
    runtime: agent.runtime,
    skills: agent.skills,
    allowedTools: agent["allowed-tools"],
    systemPrompt: agent.systemPrompt,
    created: agent.created,
    lastModified: agent.lastModified,
  });
}

const PatchSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  runtime: z.string().min(1).optional(),
  skills: z.array(z.string()).optional(),
  allowedTools: z.array(z.string()).optional(),
  systemPrompt: z.string().min(1).optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  await ensureServerBooted();
  const { slug } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid request", issues: parsed.error.issues }, { status: 400 });
  }
  try {
    const agent = updateAgent(slug, parsed.data);
    return NextResponse.json({ slug: agent.slug });
  } catch (err) {
    if (err instanceof AgentValidationError) {
      const notFound = err.errors.some(e => e.startsWith("agent not found"));
      return NextResponse.json({ error: err.message, errors: err.errors }, { status: notFound ? 404 : 400 });
    }
    throw err;
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    archiveAgent(slug);
    return new Response(null, { status: 204 });
  } catch (err) {
    if (err instanceof AgentValidationError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    throw err;
  }
}
