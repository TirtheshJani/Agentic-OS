// dashboard/lib/rag/providers/types.ts
export interface EmbeddingProvider {
  id: string;
  model: string;
  dims: number;
  /** Embed document chunks (RETRIEVAL_DOCUMENT task). Vectors are L2-normalized. */
  embedDocuments(texts: string[]): Promise<Float32Array[]>;
  /** Embed a search query (RETRIEVAL_QUERY task). Vector is L2-normalized. */
  embedQuery(text: string): Promise<Float32Array>;
}

/** L2-normalize in place and return the vector; cosine becomes a dot product. */
export function l2Normalize(v: Float32Array): Float32Array {
  let sum = 0;
  for (let i = 0; i < v.length; i++) sum += v[i] * v[i];
  const norm = Math.sqrt(sum);
  if (norm > 0) for (let i = 0; i < v.length; i++) v[i] /= norm;
  return v;
}

export function dot(a: Float32Array, b: Float32Array): number {
  let s = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) s += a[i] * b[i];
  return s;
}
