import { apiFetch } from './client';

export interface RagBudget {
  day: string;
  inserts: number;
  cap: number;
  remaining: number;
  // Legacy USD fields (always 0 with proxy, kept for backward compat)
  spent_usd: number;
  cap_usd: number;
  remaining_usd: number;
  input_tokens: number;
  output_tokens: number;
}

export interface RagStatus {
  status: string;
  error: string;
  server_url?: string;
  server_status?: string;
  core_version?: string;
  api_version?: string;
  pipeline_busy?: boolean;
  llm_model?: string;
  llm_binding?: string;
  embedding_model?: string;
  started_at: string | null;
  ready_at: string | null;
  model: string;
  embedding_dim: number | null;
  working_dir: string;
  budget: RagBudget;
}

export interface RagSearchResult {
  query: string;
  mode: string;
  top_k: number;
  answer: string;
  result: string;
  references?: unknown[];
}

export interface RagDoc {
  doc_id: string;
  source: string;
  tags: string[];
  chars: number;
  inserted_at: string;
}

export interface LiveDoc {
  id: string;
  content_summary: string;
  content_length: number;
  status: string;
  created_at: string;
  updated_at: string;
  file_path?: string;
  error_msg?: string;
}

export interface IngestSourceStats {
  scanned: number;
  ingested: number;
}

export interface IngestStatus {
  status: string;
  last_scan_at: string | null;
  next_scan_at: string | null;
  total_ingested: number;
  last_run_ingested: number;
  last_error: string;
  sources: {
    claude_code: IngestSourceStats;
    codex: IngestSourceStats;
    antigravity: IngestSourceStats;
  };
}

export interface IngestLogEntry {
  ts: string;
  action: string;
  source: string;
  path: string;
  detail: string;
}

export const fetchRagStatus = (): Promise<RagStatus> =>
  apiFetch<RagStatus>('/api/memory/rag/status');

export const searchRag = (
  query: string,
  mode: string,
  topK: number,
): Promise<RagSearchResult> =>
  apiFetch<RagSearchResult>('/api/memory/rag/search', {
    method: 'POST',
    body: JSON.stringify({ query, mode, top_k: topK }),
  });

export const addRagDoc = (
  content: string,
  source: string,
  tags: string[],
  docId?: string,
): Promise<RagDoc> =>
  apiFetch<RagDoc>('/api/memory/rag/add', {
    method: 'POST',
    body: JSON.stringify({ content, source, tags, doc_id: docId }),
  });

export const listRagDocs = (
  filters?: { source?: string; tag?: string },
): Promise<{ docs: RagDoc[]; count: number }> => {
  const params = new URLSearchParams();
  if (filters?.source) params.set('source', filters.source);
  if (filters?.tag) params.set('tag', filters.tag);
  const qs = params.toString();
  return apiFetch<{ docs: RagDoc[]; count: number }>(`/api/memory/rag/list${qs ? `?${qs}` : ''}`);
};

export const fetchLiveRagDocs = (
  page = 1,
  pageSize = 50,
): Promise<{ docs: LiveDoc[]; source: string; error?: string }> =>
  apiFetch(`/api/memory/rag/docs/live?page=${page}&page_size=${pageSize}`);

export const fetchRagDocCounts = (): Promise<Record<string, unknown>> =>
  apiFetch('/api/memory/rag/docs/counts');

export const fetchIngestStatus = (): Promise<IngestStatus> =>
  apiFetch<IngestStatus>('/api/memory/ingest/status');

export const triggerIngest = (): Promise<{ triggered: boolean }> =>
  apiFetch('/api/memory/ingest/trigger', { method: 'POST', body: '{}' });

export const fetchIngestLog = (limit = 50): Promise<{ log: IngestLogEntry[] }> =>
  apiFetch(`/api/memory/ingest/log?limit=${limit}`);
