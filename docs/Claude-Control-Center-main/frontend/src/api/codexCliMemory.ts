import { apiFetch } from './client';

export interface CodexHistoryItem {
  session_id: string;
  ts: number;
  text: string;
  datetime: string;
}

export interface CodexHistoryResponse {
  total: number;
  page: number;
  limit: number;
  items: CodexHistoryItem[];
}

export interface CodexSessionIndexItem {
  id: string;
  thread_name: string;
  updated_at: string;
}

export interface CodexSessionIndexResponse {
  total: number;
  page: number;
  limit: number;
  items: CodexSessionIndexItem[];
}

export const fetchCodexHistory = (
  page = 1,
  limit = 50,
  search = '',
): Promise<CodexHistoryResponse> => {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (search) params.set('search', search);
  return apiFetch<CodexHistoryResponse>(`/api/codex-cli/memory/history?${params}`);
};

export const fetchCodexSessionIndex = (
  page = 1,
  limit = 50,
): Promise<CodexSessionIndexResponse> => {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  return apiFetch<CodexSessionIndexResponse>(`/api/codex-cli/memory/session-index?${params}`);
};
