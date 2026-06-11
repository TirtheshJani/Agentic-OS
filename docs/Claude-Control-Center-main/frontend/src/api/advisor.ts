import { apiFetch } from './client';

export interface AdvisorUsage {
  session_id: string;
  project_dir: string;
  project: string;
  project_path: string;
  cwd: string | null;
  git_branch: string | null;
  tool_use_id: string;
  started_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  executor_model: string | null;
  advisor_model: string | null;
  advice_text: string;
  status: 'success' | 'error' | 'unknown';
}

export interface AdvisorUsagesResponse {
  total: number;
  page: number;
  limit: number;
  items: AdvisorUsage[];
}

export interface ModelPairBucket {
  pair: string;
  count: number;
}

export interface ProjectBucket {
  project: string;
  count: number;
}

export interface WeekBucket {
  week: string;
  count: number;
}

export interface AdvisorStats {
  total: number;
  projects: ProjectBucket[];
  model_pairs: ModelPairBucket[];
  avg_duration_seconds: number | null;
  success_rate: number | null;
  by_week: WeekBucket[];
}

export const fetchAdvisorUsages = (page = 1, limit = 50, project?: string): Promise<AdvisorUsagesResponse> => {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (project) params.set('project', project);
  return apiFetch<AdvisorUsagesResponse>(`/api/advisor/usages?${params}`);
};

export const fetchAdvisorStats = (): Promise<AdvisorStats> =>
  apiFetch<AdvisorStats>('/api/advisor/stats');

export const triggerAdvisorScan = (): Promise<{ scanned: number; stats: AdvisorStats }> =>
  apiFetch('/api/advisor/scan', { method: 'POST' });
