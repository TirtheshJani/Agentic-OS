import { NextResponse } from "next/server";
import { listAgents } from "@/lib/agents";

export async function GET() {
  const agents = listAgents().map(a => ({
    slug: a.slug,
    name: a.name,
    runtime: a.runtime,
    skills: a.skills,
    allowedTools: a["allowed-tools"],
    lastModified: a.lastModified,
  }));
  return NextResponse.json({ agents });
}
