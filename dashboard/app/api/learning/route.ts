import { NextResponse } from "next/server";
import { openDb } from "@/lib/db";
import { ensureServerBooted } from "@/lib/server-init";
import { listTopics, createTopic } from "@/lib/learning/topics";

export const dynamic = "force-dynamic";

export async function GET() {
  await ensureServerBooted();
  openDb();
  return NextResponse.json({ topics: listTopics() });
}

export async function POST(req: Request) {
  await ensureServerBooted();
  openDb();
  let body: { title?: string; tutorSlug?: string; goals?: string };
  try {
    body = (await req.json()) as { title?: string; tutorSlug?: string; goals?: string };
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  if (!body.title?.trim() || !body.tutorSlug?.trim()) {
    return NextResponse.json({ error: "title and tutorSlug are required" }, { status: 400 });
  }
  try {
    const topic = createTopic({ title: body.title.trim(), tutorSlug: body.tutorSlug.trim(), goals: body.goals });
    return NextResponse.json(topic, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
