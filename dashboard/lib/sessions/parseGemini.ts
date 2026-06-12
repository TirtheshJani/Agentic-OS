// dashboard/lib/sessions/parseGemini.ts
// Pure parser for Gemini CLI session files (spec 0018). These are state-patch
// JSONL: a header record then {"$set": {"messages": [...]}} patches; the last
// $set wins. No token usage fields are present, so tokens stay null.
import type { ParsedSession, SessionMessage } from "@/lib/sessions/parseClaude";

interface GeminiMessage {
  role?: string;
  type?: string;
  content?: unknown;
  parts?: Array<{ text?: string }>;
  text?: string;
  timestamp?: string;
}

function messageText(m: GeminiMessage): string {
  if (typeof m.content === "string") return m.content;
  if (Array.isArray(m.parts)) return m.parts.map((p) => p?.text ?? "").join("");
  if (typeof m.text === "string") return m.text;
  if (m.content != null) {
    try {
      return JSON.stringify(m.content).slice(0, 1000);
    } catch {
      return "";
    }
  }
  return "";
}

export function parseGeminiSession(jsonlText: string): ParsedSession {
  let sessionId: string | null = null;
  let startedAt: number | null = null;
  let endedAt: number | null = null;
  let finalMessages: GeminiMessage[] = [];

  for (const line of jsonlText.split("\n")) {
    if (!line.trim()) continue;
    let rec: Record<string, unknown>;
    try {
      rec = JSON.parse(line) as Record<string, unknown>;
    } catch {
      continue;
    }
    if (typeof rec.sessionId === "string") sessionId = rec.sessionId;
    if (typeof rec.startTime === "string") {
      const t = Date.parse(rec.startTime);
      if (!Number.isNaN(t)) startedAt = t;
    }
    if (typeof rec.lastUpdated === "string") {
      const t = Date.parse(rec.lastUpdated);
      if (!Number.isNaN(t)) endedAt = t;
    }
    const set = rec.$set as Record<string, unknown> | undefined;
    if (set && Array.isArray(set.messages)) {
      finalMessages = set.messages as GeminiMessage[];
    }
  }

  const messages: SessionMessage[] = [];
  let turnsUser = 0;
  let turnsAssistant = 0;
  for (const m of finalMessages) {
    const role = m.role === "user" || m.type === "user" ? "user" : "assistant";
    if (role === "user") turnsUser++;
    else turnsAssistant++;
    messages.push({ role, text: messageText(m), toolCalls: [], timestamp: m.timestamp });
  }

  return {
    summary: {
      sessionId,
      cwd: null,
      startedAt,
      endedAt,
      turnsUser,
      turnsAssistant,
      toolCalls: 0,
      tokens: null,
      models: {},
    },
    messages,
  };
}
