// dashboard/lib/rag/answer/cliAnswer.ts
// One-shot CLI answer providers for grounded RAG answers (spec 0013, ADR-013).
// gemini-cli bills the operator's Google AI Pro account; claude-cli draws from
// the Agent SDK credit pool and must stay an explicit settings opt-in. Same
// one-call/no-retry policy and stdin-prompt shape as lib/createProject/draft.ts:
// with shell:true (needed for .cmd shims on Windows) argv is concatenated
// unquoted, so the prompt must go over stdin.
import { spawnSync } from "node:child_process";

export type AnswerProviderId = "gemini-cli" | "claude-cli";

const TIMEOUT_MS = 60_000;
const MAX_BUFFER = 8 * 1024 * 1024;

export function runCliAnswer(
  provider: AnswerProviderId,
  prompt: string
): { ok: true; text: string } | { ok: false; error: string } {
  const win = process.platform === "win32";
  const bin = provider === "gemini-cli" ? (win ? "gemini.cmd" : "gemini") : win ? "claude.cmd" : "claude";
  const args = provider === "gemini-cli" ? ["-p"] : ["-p", "--output-format", "json"];

  const r = spawnSync(bin, args, {
    input: prompt,
    encoding: "utf8",
    shell: win,
    timeout: TIMEOUT_MS,
    maxBuffer: MAX_BUFFER,
  });
  if (r.error || r.status !== 0) {
    const detail = r.error?.message || r.stderr || `exit ${r.status}`;
    return { ok: false, error: `${provider} answer failed: ${detail}` };
  }

  if (provider === "claude-cli") {
    // claude -p --output-format json wraps the reply in an envelope.
    try {
      const envelope = JSON.parse(r.stdout) as { result?: unknown };
      if (typeof envelope.result === "string") return { ok: true, text: envelope.result };
    } catch {
      // fall through to raw stdout
    }
  }
  return { ok: true, text: r.stdout.trim() };
}
