// dashboard/lib/rag/ask.ts
// Grounded question answering over the vault: retrieve, build a numbered
// context prompt, call the configured one-shot answer provider, parse [n]
// citations out of the reply.
import { getSettings } from "@/lib/settings";
import { retrieve, type RetrievalResult, type RetrievalScope } from "@/lib/rag/retrieval";
import { runCliAnswer, type AnswerProviderId } from "@/lib/rag/answer/cliAnswer";

export interface AskResult {
  answer: string | null;
  provider: AnswerProviderId | "none";
  citations: Array<{ n: number; notePath: string; title: string }>;
  chunks: RetrievalResult["chunks"];
  degraded: RetrievalResult["degraded"];
  error?: string;
}

export function buildGroundedPrompt(q: string, chunks: RetrievalResult["chunks"]): string {
  const context = chunks
    .map((c, i) => `[${i + 1}] (${c.notePath}${c.heading ? ` — ${c.heading}` : ""})\n${c.content}`)
    .join("\n\n");
  return [
    "You answer questions about a personal knowledge vault. Use ONLY the numbered context blocks below.",
    "Cite the blocks you used as [n] inline. If the context is insufficient to answer, say so plainly.",
    "",
    "Context:",
    context,
    "",
    `Question: ${q}`,
  ].join("\n");
}

export function parseCitations(
  answer: string,
  chunks: RetrievalResult["chunks"]
): Array<{ n: number; notePath: string; title: string }> {
  const seen = new Set<number>();
  for (const m of answer.matchAll(/\[(\d{1,2})\]/g)) {
    const n = Number(m[1]);
    if (n >= 1 && n <= chunks.length) seen.add(n);
  }
  return [...seen].sort((a, b) => a - b).map((n) => ({
    n,
    notePath: chunks[n - 1].notePath,
    title: chunks[n - 1].title,
  }));
}

export async function askVault(opts: { q: string; k?: number; scope?: RetrievalScope }): Promise<AskResult> {
  const retrieval = await retrieve(opts);
  const providerSetting = getSettings().rag.answerProvider;

  if (providerSetting === "none" || retrieval.chunks.length === 0) {
    return {
      answer: null,
      provider: "none",
      citations: [],
      chunks: retrieval.chunks,
      degraded: retrieval.degraded,
    };
  }

  const result = runCliAnswer(providerSetting, buildGroundedPrompt(opts.q, retrieval.chunks));
  if (!result.ok) {
    return {
      answer: null,
      provider: providerSetting,
      citations: [],
      chunks: retrieval.chunks,
      degraded: retrieval.degraded,
      error: result.error,
    };
  }
  return {
    answer: result.text,
    provider: providerSetting,
    citations: parseCitations(result.text, retrieval.chunks),
    chunks: retrieval.chunks,
    degraded: retrieval.degraded,
  };
}
