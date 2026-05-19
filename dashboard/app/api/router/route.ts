import { routeToTeam } from "@/lib/router";
import { loadTeams } from "@/lib/teams";

export const dynamic = "force-dynamic";

type RouterBody = {
  prompt?: string;
  allowLlm?: boolean;
};

export async function GET() {
  const teams = loadTeams().map((t) => ({
    slug: t.slug,
    name: t.name,
    path: t.path,
    description: t.description,
    source: t.source,
    pathExists: t.pathExists,
    capabilities: t.capabilities,
    agent: t.agent,
    localAgents: t.localAgents,
    localSkills: t.localSkills,
  }));
  return Response.json({ teams });
}

export async function POST(req: Request) {
  let body: RouterBody;
  try {
    body = (await req.json()) as RouterBody;
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }
  const prompt = body.prompt?.trim();
  if (!prompt) {
    return Response.json({ error: "prompt required" }, { status: 400 });
  }
  const result = await routeToTeam(prompt, {
    allowLlm: body.allowLlm !== false,
    signal: req.signal,
  });
  if (result.slug === null) {
    return Response.json(
      {
        ok: false,
        mode: result.mode,
        reason: result.reason,
      },
      { status: 409 }
    );
  }
  return Response.json({
    ok: true,
    slug: result.slug,
    name: result.team.name,
    path: result.team.path,
    source: result.team.source,
    mode: result.mode,
    confidence: result.confidence,
    reason: result.reason,
  });
}
