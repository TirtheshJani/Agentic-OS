import { NextResponse } from "next/server";
import { readMcpTemplate, writeMcpTemplate, type McpTemplate } from "@/lib/mcp";

export const dynamic = "force-dynamic";

const NAME_RE = /^[a-z0-9][a-z0-9-]*$/;

export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  if (!NAME_RE.test(name)) return NextResponse.json({ error: "invalid name" }, { status: 400 });
  const template = readMcpTemplate(name);
  return NextResponse.json({ name, template: template ?? {} });
}

export async function PUT(req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  if (!NAME_RE.test(name)) return NextResponse.json({ error: "invalid name" }, { status: 400 });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "template must be a JSON object mapping server name to config" }, { status: 400 });
  }
  try {
    writeMcpTemplate(name, body as McpTemplate);
    return NextResponse.json({ name, servers: Object.keys(body) });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
