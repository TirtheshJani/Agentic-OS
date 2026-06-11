// dashboard/lib/rag/providers/gemini.ts
// Gemini embedding provider over plain REST (no SDK dependency).
// Truncated (non-3072-dim) Gemini vectors are not pre-normalized, so every
// vector is L2-normalized before it leaves this module.
import { l2Normalize, type EmbeddingProvider } from "@/lib/rag/providers/types";

const BASE = "https://generativelanguage.googleapis.com/v1beta";
const BATCH_LIMIT = 100;

interface BatchResponse {
  embeddings?: Array<{ values?: number[] }>;
}

async function batchEmbed(
  apiKey: string,
  model: string,
  dims: number,
  texts: string[],
  taskType: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY"
): Promise<Float32Array[]> {
  const out: Float32Array[] = [];
  for (let i = 0; i < texts.length; i += BATCH_LIMIT) {
    const slice = texts.slice(i, i + BATCH_LIMIT);
    const res = await fetch(`${BASE}/models/${model}:batchEmbedContents?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: slice.map((text) => ({
          model: `models/${model}`,
          content: { parts: [{ text }] },
          taskType,
          outputDimensionality: dims,
        })),
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`gemini embed failed: HTTP ${res.status} ${body.slice(0, 300)}`);
    }
    const data = (await res.json()) as BatchResponse;
    const embeddings = data.embeddings ?? [];
    if (embeddings.length !== slice.length) {
      throw new Error(`gemini embed returned ${embeddings.length} vectors for ${slice.length} inputs`);
    }
    for (const e of embeddings) {
      out.push(l2Normalize(Float32Array.from(e.values ?? [])));
    }
  }
  return out;
}

export function geminiEmbeddingProvider(apiKey: string, model: string, dims: number): EmbeddingProvider {
  return {
    id: "gemini",
    model,
    dims,
    embedDocuments: (texts) => batchEmbed(apiKey, model, dims, texts, "RETRIEVAL_DOCUMENT"),
    embedQuery: async (text) => {
      const [v] = await batchEmbed(apiKey, model, dims, [text], "RETRIEVAL_QUERY");
      return v;
    },
  };
}
