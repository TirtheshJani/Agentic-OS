import { NextResponse } from "next/server";
import fs from "node:fs";
import { openDb, getDb } from "@/lib/db";
import { ensureServerBooted } from "@/lib/server-init";
import { parseClaudeSession } from "@/lib/sessions/parseClaude";
import { parseGeminiSession } from "@/lib/sessions/parseGemini";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 200;

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await ensureServerBooted();
  openDb();
  const { id } = await params;
  const row = getDb()
    .prepare(
      `SELECT id, provider, session_id AS sessionId, file_path AS filePath, project_dir AS projectDir,
              project_slug AS projectSlug, run_id AS runId, started_at AS startedAt, ended_at AS endedAt,
              turns_user AS turnsUser, turns_assistant AS turnsAssistant, tool_calls AS toolCalls,
              tokens_in AS tokensIn, tokens_out AS tokensOut, tokens_cache_write AS tokensCacheWrite,
              tokens_cache_read AS tokensCacheRead, models, cost_estimate AS costEstimate
       FROM sessions WHERE id = ?`
    )
    .get(Number(id)) as Record<string, unknown> | undefined;
  if (!row) return NextResponse.json({ error: "session not found" }, { status: 404 });

  const filePath = row.filePath as string;
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: "transcript file no longer exists" }, { status: 404 });
  }
  const text = fs.readFileSync(filePath, "utf8");
  const parsed = row.provider === "gemini-cli" ? parseGeminiSession(text) : parseClaudeSession(text);

  const { searchParams } = new URL(req.url);
  const page = Math.max(0, parseInt(searchParams.get("page") ?? "0", 10) || 0);
  const start = page * PAGE_SIZE;

  return NextResponse.json({
    summary: { ...row, models: row.models ? JSON.parse(row.models as string) : {} },
    messages: parsed.messages.slice(start, start + PAGE_SIZE),
    totalMessages: parsed.messages.length,
    page,
    pageSize: PAGE_SIZE,
  });
}
