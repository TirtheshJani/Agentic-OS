// dashboard/lib/rag/providerRegistry.ts
import { getSettings } from "@/lib/settings";
import { geminiEmbeddingProvider } from "@/lib/rag/providers/gemini";
import type { EmbeddingProvider } from "@/lib/rag/providers/types";

/**
 * Resolve the active embedding provider from settings. Returns null when the
 * provider is "none" or unconfigured; callers degrade to FTS + graph retrieval.
 */
export function getEmbeddingProvider(): EmbeddingProvider | null {
  const { rag } = getSettings();
  if (rag.embeddingProvider === "gemini" && rag.geminiApiKey) {
    return geminiEmbeddingProvider(rag.geminiApiKey, rag.embeddingModel, rag.embeddingDims);
  }
  return null;
}
