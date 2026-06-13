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
  autonomy: z
    .object({
      enabled: z.boolean(),
      llmRouting: z.boolean(),
      schedulerEnabled: z.boolean(),
      maxChainDepth: z.number().int().positive(),
    })
    .optional(),
  rag: z
    .object({
      embeddingProvider: z.enum(["gemini", "none"]),
      geminiApiKey: z.string(),
      embeddingModel: z.string(),
      embeddingDims: z.number().int().positive(),
      answerProvider: z.enum(["gemini-cli", "claude-cli", "none"]),
    })
    .optional(),
  lightrag: z
    .object({
      baseUrl: z.string().min(1),
      autoIngest: z.boolean(),
    })
    .optional(),
  export: z
    .object({
      notebookLmDir: z.string(),
    })
    .optional(),
  evals: z
    .object({
      judgeProvider: z.enum(["inherit", "gemini-cli", "claude-cli", "none"]),
      autoGradeEnabled: z.boolean(),
      batchLimit: z.number().int().positive(),
      reviseThreshold: z.number().int().min(0).max(100),
      behavioralEnabled: z.boolean().optional(),
    })
    .optional(),
  docker: z
    .object({
      enabled: z.boolean(),
      allowlist: z.array(z.string()),
    })
    .optional(),
  features: z
    .object({
      notes: z.boolean(),
      inbox: z.boolean(),
      ask: z.boolean(),
      graph: z.boolean(),
      learning: z.boolean(),
      research: z.boolean(),
      studio: z.boolean(),
      sessions: z.boolean(),
      analytics: z.boolean(),
      evals: z.boolean(),
      docker: z.boolean(),
      connections: z.boolean(),
    })
    .optional(),
  roleAssignment: z
    .object({
      plan: z.string().optional(),
      implement: z.string().optional(),
      validate: z.string().optional(),
    })
    .optional(),
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
