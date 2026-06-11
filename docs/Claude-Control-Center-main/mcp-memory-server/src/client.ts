const BASE_URL = process.env.CCC_BASE_URL ?? "http://127.0.0.1:5050";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

async function apiFetch(path: string, options: RequestInit = {}): Promise<unknown> {
  const method = (options.method ?? "GET").toUpperCase();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> ?? {}),
  };

  if (MUTATING_METHODS.has(method)) {
    headers["X-Requested-With"] = "XMLHttpRequest";
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`CCC API ${method} ${path} → ${response.status}: ${text}`);
  }

  return response.json();
}

export async function searchMemory(
  query: string,
  mode: "hybrid" | "local" | "global" = "hybrid",
  topK: number = 10
): Promise<unknown> {
  return apiFetch("/api/memory/rag/search", {
    method: "POST",
    body: JSON.stringify({ query, mode, top_k: topK }),
  });
}

export async function addMemory(
  content: string,
  source: string = "mcp",
  tags: string[] = [],
  docId?: string
): Promise<unknown> {
  return apiFetch("/api/memory/rag/add", {
    method: "POST",
    body: JSON.stringify({ content, source, tags, doc_id: docId }),
  });
}

export async function listMemories(filters?: { source?: string; tag?: string }): Promise<unknown> {
  const params = new URLSearchParams();
  if (filters?.source) params.set("source", filters.source);
  if (filters?.tag) params.set("tag", filters.tag);
  const qs = params.toString();
  return apiFetch(`/api/memory/rag/list${qs ? `?${qs}` : ""}`);
}

export async function getMemoryStatus(): Promise<unknown> {
  return apiFetch("/api/memory/rag/status");
}
