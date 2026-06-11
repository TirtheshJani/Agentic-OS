import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureServerBooted } from "@/lib/server-init";
import { getRuntime } from "@/lib/runtime/registry";
import { startCreateProjectJob } from "@/lib/createProject/pipeline";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  prompt: z.string().min(10, "describe the project in at least a sentence"),
  visibility: z.enum(["private", "public", "local-only"]).default("private"),
  runtimeDefault: z.string().default("claude-code"),
  fileIssues: z.boolean().default(true),
});

export async function POST(req: Request) {
  // The runtime registry must be populated for draft prompts and validation.
  await ensureServerBooted();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid request", issues: parsed.error.issues }, { status: 400 });
  }
  if (!getRuntime(parsed.data.runtimeDefault)) {
    return NextResponse.json(
      { error: `runtime not registered: ${parsed.data.runtimeDefault}` },
      { status: 400 }
    );
  }

  const started = startCreateProjectJob(parsed.data);
  if ("error" in started) {
    return NextResponse.json(
      { error: "a create job is already running", jobId: started.jobId },
      { status: 409 }
    );
  }
  return NextResponse.json({ jobId: started.job.id, steps: started.job.steps }, { status: 202 });
}
