import { NextResponse } from "next/server";
import { z } from "zod";
import { openDb } from "@/lib/db";
import { createEpic } from "@/lib/epics";
import { assembleEpicsView } from "@/lib/epicsView";

openDb(); // initializes the singleton if not already

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const projectSlug = searchParams.get("projectSlug") ?? undefined;
  return NextResponse.json({ epics: assembleEpicsView(projectSlug) });
}

const CreateSchema = z.object({
  projectSlug: z.string().min(1),
  title: z.string().min(1),
  why: z.string().optional(),
  sharedContract: z.string().optional(),
  milestone: z.string().nullable().optional(),
});

export async function POST(req: Request) {
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
  const id = createEpic(parsed.data);
  return NextResponse.json({ id }, { status: 201 });
}
