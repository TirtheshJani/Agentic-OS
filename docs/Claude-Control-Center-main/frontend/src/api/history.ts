import { apiFetch } from './client';
import type { HistoryItem } from '../types';

export interface HistoryResponse {
  total: number;
  items: HistoryItem[];
}

export const fetchHistory = (limit = 100, offset = 0, project?: string): Promise<HistoryResponse> => {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (project) params.set('project', project);
  return apiFetch<HistoryResponse>(`/api/history?${params}`);
};
