// dashboard/lib/sessions/parseClaude.ts
// Pure parser for Claude Code transcript JSONL files (spec 0018).
// Tolerant by design: per-line try/catch, unknown record types skipped.

export interface ModelUsage {
  in: number;
  out: number;
  cacheWrite: number;
  cacheRead: number;
  turns: number;
}

export interface SessionToolCall {
  name: string;
  inputPreview: string;
  output?: string;
}

export interface SessionMessage {
  role: "user" | "assistant";
  text: string;
  toolCalls: SessionToolCall[];
  model?: string;
  timestamp?: string;
}

export interface ParsedSession {
  summary: {
    sessionId: string | null;
    cwd: string | null;
    startedAt: number | null;
    endedAt: number | null;
    turnsUser: number;
    turnsAssistant: number;
    toolCalls: number;
    tokens: { in: number; out: number; cacheWrite: number; cacheRead: number } | null;
    models: Record<string, ModelUsage>;
  };
  messages: SessionMessage[];
}

interface ContentBlock {
  type?: string;
  text?: string;
  name?: string;
  input?: unknown;
  content?: unknown;
}

function blockText(content: unknown): { text: string; toolCalls: SessionToolCall[] } {
  if (typeof content === "string") return { text: content, toolCalls: [] };
  if (!Array.isArray(content)) return { text: "", toolCalls: [] };
  const parts: string[] = [];
  const toolCalls: SessionToolCall[] = [];
  for (const block of content as ContentBlock[]) {
    if (block?.type === "text" && typeof block.text === "string") {
      parts.push(block.text);
    } else if (block?.type === "tool_use") {
      let preview = "";
      try {
        preview = JSON.stringify(block.input ?? {}).slice(0, 200);
      } catch {
        preview = "(unserializable input)";
      }
      toolCalls.push({ name: block.name ?? "unknown", inputPreview: preview });
    } else if (block?.type === "tool_result") {
      const inner = typeof block.content === "string" ? block.content : JSON.stringify(block.content ?? "");
      parts.push(`[tool result] ${String(inner).slice(0, 400)}`);
    }
  }
  return { text: parts.join("\n"), toolCalls };
}

export function parseClaudeSession(jsonlText: string): ParsedSession {
  const messages: SessionMessage[] = [];
  const models: Record<string, ModelUsage> = {};
  let sessionId: string | null = null;
  let cwd: string | null = null;
  let startedAt: number | null = null;
  let endedAt: number | null = null;
  let turnsUser = 0;
  let turnsAssistant = 0;
  let toolCalls = 0;
  let sawUsage = false;
  const tokens = { in: 0, out: 0, cacheWrite: 0, cacheRead: 0 };

  for (const line of jsonlText.split("\n")) {
    if (!line.trim()) continue;
    let rec: Record<string, unknown>;
    try {
      rec = JSON.parse(line) as Record<string, unknown>;
    } catch {
      continue;
    }
    const type = rec.type;
    if (type !== "user" && type !== "assistant") continue;
    if (rec.isMeta === true || rec.isSidechain === true) continue;

    if (!sessionId && typeof rec.sessionId === "string") sessionId = rec.sessionId;
    if (!cwd && typeof rec.cwd === "string") cwd = rec.cwd;
    if (typeof rec.timestamp === "string") {
      const t = Date.parse(rec.timestamp);
      if (!Number.isNaN(t)) {
        if (startedAt === null || t < startedAt) startedAt = t;
        if (endedAt === null || t > endedAt) endedAt = t;
      }
    }

    const message = rec.message as Record<string, unknown> | undefined;
    const { text, toolCalls: calls } = blockText(message?.content);

    if (type === "user") {
      turnsUser++;
      messages.push({ role: "user", text, toolCalls: [], timestamp: rec.timestamp as string | undefined });
      continue;
    }

    turnsAssistant++;
    toolCalls += calls.length;
    const model = typeof message?.model === "string" ? message.model : undefined;
    const usage = message?.usage as Record<string, unknown> | undefined;
    if (usage && model) {
      sawUsage = true;
      const u = {
        in: Number(usage.input_tokens ?? 0),
        out: Number(usage.output_tokens ?? 0),
        cacheWrite: Number(usage.cache_creation_input_tokens ?? 0),
        cacheRead: Number(usage.cache_read_input_tokens ?? 0),
      };
      tokens.in += u.in;
      tokens.out += u.out;
      tokens.cacheWrite += u.cacheWrite;
      tokens.cacheRead += u.cacheRead;
      const m = (models[model] ??= { in: 0, out: 0, cacheWrite: 0, cacheRead: 0, turns: 0 });
      m.in += u.in;
      m.out += u.out;
      m.cacheWrite += u.cacheWrite;
      m.cacheRead += u.cacheRead;
      m.turns++;
    }
    messages.push({ role: "assistant", text, toolCalls: calls, model, timestamp: rec.timestamp as string | undefined });
  }

  return {
    summary: {
      sessionId,
      cwd,
      startedAt,
      endedAt,
      turnsUser,
      turnsAssistant,
      toolCalls,
      tokens: sawUsage ? tokens : null,
      models,
    },
    messages,
  };
}
