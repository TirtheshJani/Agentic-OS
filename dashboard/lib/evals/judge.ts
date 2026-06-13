// dashboard/lib/evals/judge.ts
// Layer B: optional LLM-judge rubric scoring (spec 0020). One provider call
// per grade via the spec-0013 answer mechanism; never looped, never retried.
import { z } from "zod";
import fs from "node:fs";
import { getSettings } from "@/lib/settings";
import { runCliAnswer, type AnswerProviderId } from "@/lib/rag/answer/cliAnswer";
import { extractJsonObject } from "@/lib/llm/extractJson";
import { parseClaudeSession } from "@/lib/sessions/parseClaude";
import type { RunMetrics } from "@/lib/evals/metrics";
import type { Assertion } from "@/lib/evals/contract";

const INPUT_CHAR_BUDGET = 24_000;
export const WEIGHTS = { correctness: 0.4, efficiency: 0.3, coherence: 0.3 } as const;

export interface AssertionResult {
  text: string;
  pass: boolean;
  reason: string;
}

// What the judge LLM is asked to return. `correctness` is optional because the
// contract path derives it from the assertion pass-fraction instead of asking
// the judge for a number; `assertions` is present only when a contract was
// graded. Bounds match ADR-016 (0-100), so a malformed reply still fails parse.
const JudgeReplySchema = z.object({
  correctness: z.number().min(0).max(100).optional(),
  efficiency: z.number().min(0).max(100),
  coherence: z.number().min(0).max(100),
  rationale: z.string().default(""),
  assertions: z
    .array(z.object({ text: z.string(), pass: z.boolean(), reason: z.string().default("") }))
    .optional(),
});

/**
 * The normalized rubric we persist and score. `correctness` is always present
 * (derived from the pass fraction when a contract was graded, otherwise taken
 * from the judge). `assertions` rides along only on the contract path.
 */
export interface Rubric {
  correctness: number;
  efficiency: number;
  coherence: number;
  rationale: string;
  assertions?: AssertionResult[];
}

export function letterGrade(score: number): string {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

export function compositeScore(r: Rubric): number {
  return r.correctness * WEIGHTS.correctness + r.efficiency * WEIGHTS.efficiency + r.coherence * WEIGHTS.coherence;
}

export function resolveJudgeProvider(): AnswerProviderId | null {
  const s = getSettings();
  const setting = s.evals.judgeProvider === "inherit" ? s.rag.answerProvider : s.evals.judgeProvider;
  return setting === "none" ? null : setting;
}

/** Final assistant messages from a transcript, bounded. */
function finalAssistantText(transcriptPath: string | null): string {
  if (!transcriptPath || !fs.existsSync(transcriptPath)) return "(transcript unavailable)";
  try {
    const parsed = parseClaudeSession(fs.readFileSync(transcriptPath, "utf8"));
    const assistant = parsed.messages.filter((m) => m.role === "assistant" && m.text.trim());
    return assistant
      .slice(-3)
      .map((m) => m.text)
      .join("\n\n---\n\n");
  } catch {
    return "(transcript unparseable)";
  }
}

export function buildJudgePrompt(opts: {
  issueTitle: string;
  issueBody: string;
  metrics: RunMetrics;
  transcriptPath: string | null;
  assertions?: Assertion[];
}): string {
  const contract = opts.assertions ?? [];
  const instruction =
    contract.length > 0
      ? [
          "You are grading an autonomous coding agent's finished run against an acceptance contract.",
          "For EACH assertion below decide pass or fail from the task, transcript, and metrics, with a one-line reason.",
          "Then score efficiency (turns/tokens/tool use proportionate to the task) and coherence (clear reasoning, no thrash) 0-100.",
          "Respond with ONLY a JSON object:",
          '{"assertions": [{"text": "<assertion verbatim>", "pass": true, "reason": "<one line>"}], "efficiency": n, "coherence": n, "rationale": "2-4 sentences"}.',
          "",
          "Acceptance contract:",
          contract.map((a, i) => `${i + 1}. ${a.text}`).join("\n"),
        ]
      : [
          "You are grading an autonomous coding agent's finished run. Score 0-100 on three dimensions:",
          "correctness (did the work plausibly satisfy the task and its acceptance criteria),",
          "efficiency (turns/tokens/tool use proportionate to the task),",
          "coherence (clear reasoning and communication, no thrash).",
          'Respond with ONLY a JSON object: {"correctness": n, "efficiency": n, "coherence": n, "rationale": "2-4 sentences"}.',
        ];

  const prompt = [
    ...instruction,
    "",
    `Task: ${opts.issueTitle}`,
    opts.issueBody ? `Details: ${opts.issueBody}` : "",
    "",
    `Run metrics: ${JSON.stringify(opts.metrics)}`,
    "",
    "Final assistant output:",
    finalAssistantText(opts.transcriptPath),
  ]
    .filter((l) => l !== "")
    .join("\n");
  return prompt.length > INPUT_CHAR_BUDGET ? prompt.slice(0, INPUT_CHAR_BUDGET) : prompt;
}

export function parseJudgeReply(text: string): { ok: true; rubric: Rubric } | { ok: false; error: string } {
  const raw = extractJsonObject(text);
  const parsed = JudgeReplySchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "judge reply was not a valid rubric" };
  const { correctness, efficiency, coherence, rationale, assertions } = parsed.data;

  // Contract path: correctness is the assertion pass fraction, not a judge guess.
  if (assertions && assertions.length > 0) {
    const passes = assertions.filter((a) => a.pass).length;
    const passFraction = Math.round((100 * passes) / assertions.length);
    return { ok: true, rubric: { correctness: passFraction, efficiency, coherence, rationale, assertions } };
  }

  // Generic path: the judge must supply a correctness number (regression guard).
  if (correctness == null) return { ok: false, error: "judge reply missing correctness and assertions" };
  return { ok: true, rubric: { correctness, efficiency, coherence, rationale } };
}

export function runJudge(prompt: string, provider: AnswerProviderId): { ok: true; rubric: Rubric } | { ok: false; error: string } {
  const result = runCliAnswer(provider, prompt);
  if (!result.ok) return result;
  return parseJudgeReply(result.text);
}
