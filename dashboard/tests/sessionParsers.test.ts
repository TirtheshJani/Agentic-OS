import { describe, it, expect } from "vitest";
import { parseClaudeSession } from "@/lib/sessions/parseClaude";
import { parseGeminiSession } from "@/lib/sessions/parseGemini";

function claudeLine(obj: Record<string, unknown>): string {
  return JSON.stringify(obj);
}

const CLAUDE_JSONL = [
  claudeLine({ type: "file-history-snapshot", snapshot: {} }),
  claudeLine({
    type: "user",
    sessionId: "sess-1",
    cwd: "C:\\Users\\TJ\\code\\proj",
    timestamp: "2026-06-11T10:00:00.000Z",
    message: { role: "user", content: "Fix the bug" },
  }),
  claudeLine({
    type: "assistant",
    sessionId: "sess-1",
    cwd: "C:\\Users\\TJ\\code\\proj",
    timestamp: "2026-06-11T10:00:10.000Z",
    message: {
      role: "assistant",
      model: "claude-opus-4-8",
      usage: { input_tokens: 100, output_tokens: 50, cache_creation_input_tokens: 10, cache_read_input_tokens: 1000 },
      content: [
        { type: "text", text: "Looking at it." },
        { type: "tool_use", name: "Read", input: { file_path: "a.ts" } },
      ],
    },
  }),
  claudeLine({ type: "user", isMeta: true, message: { content: "meta noise" } }),
  claudeLine({
    type: "assistant",
    sessionId: "sess-1",
    timestamp: "2026-06-11T10:01:00.000Z",
    message: {
      role: "assistant",
      model: "claude-opus-4-8",
      usage: { input_tokens: 200, output_tokens: 80, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
      content: [{ type: "text", text: "Done." }],
    },
  }),
  "not json at all {{{",
].join("\n");

describe("parseClaudeSession", () => {
  it("accumulates usage per model and counts turns and tool calls", () => {
    const parsed = parseClaudeSession(CLAUDE_JSONL);
    const s = parsed.summary;
    expect(s.sessionId).toBe("sess-1");
    expect(s.cwd).toBe("C:\\Users\\TJ\\code\\proj");
    expect(s.turnsUser).toBe(1); // isMeta skipped
    expect(s.turnsAssistant).toBe(2);
    expect(s.toolCalls).toBe(1);
    expect(s.tokens).toEqual({ in: 300, out: 130, cacheWrite: 10, cacheRead: 1000 });
    expect(s.models["claude-opus-4-8"].turns).toBe(2);
    expect(s.startedAt).toBe(Date.parse("2026-06-11T10:00:00.000Z"));
    expect(s.endedAt).toBe(Date.parse("2026-06-11T10:01:00.000Z"));
  });

  it("captures message text and tool call previews", () => {
    const parsed = parseClaudeSession(CLAUDE_JSONL);
    expect(parsed.messages.length).toBe(3);
    expect(parsed.messages[0].role).toBe("user");
    expect(parsed.messages[1].toolCalls[0].name).toBe("Read");
    expect(parsed.messages[1].toolCalls[0].inputPreview).toContain("a.ts");
  });

  it("returns null tokens when no usage records exist", () => {
    const parsed = parseClaudeSession(claudeLine({ type: "user", message: { content: "hi" } }));
    expect(parsed.summary.tokens).toBeNull();
  });
});

const GEMINI_JSONL = [
  JSON.stringify({
    sessionId: "gem-1",
    projectHash: "abc",
    startTime: "2026-06-11T09:00:00.000Z",
    lastUpdated: "2026-06-11T09:30:00.000Z",
    kind: "chat",
  }),
  JSON.stringify({ $set: { messages: [{ role: "user", content: "hello" }] } }),
  JSON.stringify({
    $set: {
      messages: [
        { role: "user", content: "hello" },
        { role: "assistant", parts: [{ text: "hi " }, { text: "there" }] },
      ],
    },
  }),
].join("\n");

describe("parseGeminiSession", () => {
  it("folds $set patches and uses the final messages array", () => {
    const parsed = parseGeminiSession(GEMINI_JSONL);
    expect(parsed.summary.sessionId).toBe("gem-1");
    expect(parsed.summary.turnsUser).toBe(1);
    expect(parsed.summary.turnsAssistant).toBe(1);
    expect(parsed.summary.tokens).toBeNull();
    expect(parsed.messages[1].text).toBe("hi there");
    expect(parsed.summary.startedAt).toBe(Date.parse("2026-06-11T09:00:00.000Z"));
  });

  it("tolerates malformed lines", () => {
    const parsed = parseGeminiSession("garbage\n" + GEMINI_JSONL);
    expect(parsed.messages.length).toBe(2);
  });
});
