import { NextResponse } from "next/server";
import { z } from "zod";
import { getSettings, setSettings } from "@/lib/settings";

export async function GET() {
  return NextResponse.json(getSettings());
}

const PatchSchema = z.object({
  workspaceRoot: z.string().min(1).optional(),
  concurrency: z
    .object({
      perProjectMax: z.number().int().positive(),
      globalMax: z.number().int().positive(),
    })
    .optional(),
  theme: z.enum(["light", "dark", "system"]).optional(),
});

export async function PATCH(req: Request) {
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
  return NextResponse.json(setSettings(parsed.data));
}
