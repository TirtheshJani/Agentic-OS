import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { openDb, getDb, closeDb } from "@/lib/db";
import { scanSessions } from "@/lib/sessions/scanner";

let tmp: string;
let claudeRoot: string;
let geminiRoot: string;

function writeClaudeSession(dirName: string, sessionId: string, extraLines: string[] = []): string {
  const dir = path.join(claudeRoot, dirName);
  fs.mkdirSync(dir, { recursive: true });
  const fp = path.join(dir, `${sessionId}.jsonl`);
  fs.writeFileSync(
    fp,
    [
      JSON.stringify({
        type: "user",
        sessionId,
        cwd: "C:\\Users\\TJ\\code\\some-proj",
        timestamp: "2026-06-11T10:00:00.000Z",
        message: { content: "hello" },
      }),
      JSON.stringify({
        type: "assistant",
        sessionId,
        timestamp: "2026-06-11T10:00:30.000Z",
        message: {
          model: "claude-opus-4-8",
          usage: { input_tokens: 10, output_tokens: 5, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
          content: [{ type: "text", text: "hi" }],
        },
      }),
      ...extraLines,
    ].join("\n")
  );
  return fp;
}

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "agentic-sessions-"));
  claudeRoot = path.join(tmp, "claude-projects");
  geminiRoot = path.join(tmp, "gemini-tmp");
  fs.mkdirSync(claudeRoot, { recursive: true });
  fs.mkdirSync(geminiRoot, { recursive: true });
  openDb(path.join(tmp, "state.db"));
});

afterEach(() => {
  closeDb();
  fs.rmSync(tmp, { recursive: true, force: true });
});

function rows(): Array<Record<string, unknown>> {
  return getDb().prepare("SELECT * FROM sessions ORDER BY file_path").all() as Array<Record<string, unknown>>;
}

describe("scanSessions", () => {
  it("indexes claude and gemini files with summaries", () => {
    writeClaudeSession("C--Users-TJ-code-some-proj", "aaaa-bbbb");
    const chats = path.join(geminiRoot, "tj", "chats");
    fs.mkdirSync(chats, { recursive: true });
    fs.writeFileSync(
      path.join(chats, "session-2026-06-11T09-00-abcd1234.jsonl"),
      [
        JSON.stringify({ sessionId: "gem-1", startTime: "2026-06-11T09:00:00.000Z", lastUpdated: "2026-06-11T09:10:00.000Z" }),
        JSON.stringify({ $set: { messages: [{ role: "user", content: "q" }] } }),
      ].join("\n")
    );

    const stats = scanSessions({ claudeRoot, geminiRoot });
    expect(stats.scanned).toBe(2);
    expect(stats.updated).toBe(2);

    const all = rows();
    const claude = all.find((r) => r.provider === "claude-code")!;
    expect(claude.session_id).toBe("aaaa-bbbb");
    expect(claude.tokens_in).toBe(10);
    expect(claude.cost_estimate).not.toBeNull();
    const gemini = all.find((r) => r.provider === "gemini-cli")!;
    expect(gemini.tokens_in).toBeNull();
  });

  it("skips unchanged files on rescan and reparses changed ones", () => {
    const fp = writeClaudeSession("C--proj", "cccc-dddd");
    scanSessions({ claudeRoot, geminiRoot });
    const second = scanSessions({ claudeRoot, geminiRoot });
    expect(second.updated).toBe(0);

    // Append a turn; mtime+size change forces a reparse.
    fs.appendFileSync(fp, "\n" + JSON.stringify({ type: "user", sessionId: "cccc-dddd", message: { content: "more" } }));
    const third = scanSessions({ claudeRoot, geminiRoot });
    expect(third.updated).toBe(1);
    expect(rows()[0].turns_user).toBe(2);
  });

  it("prunes rows for deleted files", () => {
    const fp = writeClaudeSession("C--proj", "eeee-ffff");
    scanSessions({ claudeRoot, geminiRoot });
    expect(rows().length).toBe(1);
    fs.rmSync(fp);
    const stats = scanSessions({ claudeRoot, geminiRoot });
    expect(stats.removed).toBe(1);
    expect(rows().length).toBe(0);
  });

  it("links sessions to runs via pty_session_id", () => {
    getDb()
      .prepare(
        "INSERT INTO issues (project_slug, title, body, status, mode, priority, created_at, updated_at) VALUES ('p', 't', '', 'running', 'async', 0, 1, 1)"
      )
      .run();
    getDb()
      .prepare(
        "INSERT INTO runs (issue_id, agent_slug, runtime_id, worktree_path, pty_session_id, started_at) VALUES (1, 'a', 'claude-code', 'w', 'gggg-hhhh', 1)"
      )
      .run();
    writeClaudeSession("C--proj", "gggg-hhhh");
    scanSessions({ claudeRoot, geminiRoot });
    expect(rows()[0].run_id).toBe(1);
  });
});
