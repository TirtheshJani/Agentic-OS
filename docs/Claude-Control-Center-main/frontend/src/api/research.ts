import { apiFetch } from './client';

export interface ResearchJob {
  id: string;
  title: string;
  query: string;
  sources: string[];
  subreddits?: string[];
  status: 'pending' | 'running' | 'done' | 'failed';
  created_at: string;
  completed_at: string | null;
  error: string | null;
  results: Record<string, unknown[]>;
  ingested_count: number;
  vault_id: string | null;
  log?: string;
}

export interface ResearchSourceStatus {
  youtube: { available: boolean };
  reddit: { available: boolean; configured: boolean };
  web: { available: boolean; configured: boolean };
  vault_pipeline?: { available: boolean; configured: boolean };
}

export const fetchResearchJobs = (): Promise<ResearchJob[]> =>
  apiFetch<ResearchJob[]>('/api/research/jobs');

export const createResearchJob = (params: {
  title: string;
  query: string;
  sources: string[];
  subreddits?: string[];
  max_results?: number;
  vault_id?: string;
}): Promise<ResearchJob> =>
  apiFetch<ResearchJob>('/api/research/jobs', {
    method: 'POST',
    body: JSON.stringify(params),
  });

export const fetchResearchJob = (jobId: string): Promise<ResearchJob> =>
  apiFetch<ResearchJob>(`/api/research/jobs/${jobId}`);

export const deleteResearchJob = (jobId: string): Promise<{ deleted: boolean }> =>
  apiFetch<{ deleted: boolean }>(`/api/research/jobs/${jobId}`, { method: 'DELETE' });

export const runResearchJob = (jobId: string): Promise<{ triggered: boolean }> =>
  apiFetch<{ triggered: boolean }>(`/api/research/jobs/${jobId}/run`, { method: 'POST' });

export const fetchResearchSourceStatus = (): Promise<ResearchSourceStatus> =>
  apiFetch<ResearchSourceStatus>('/api/research/sources/status');

export const fetchResearchJobLog = (jobId: string): Promise<{ log: string }> =>
  apiFetch<{ log: string }>(`/api/research/jobs/${jobId}/log`);

export const importFromVault = (vaultId: string): Promise<{ imported: number; jobs: ResearchJob[] }> =>
  apiFetch<{ imported: number; jobs: ResearchJob[] }>('/api/research/import-vault', {
    method: 'POST',
    body: JSON.stringify({ vault_id: vaultId }),
  });
