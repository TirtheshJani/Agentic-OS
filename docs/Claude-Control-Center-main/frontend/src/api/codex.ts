import { apiFetch } from './client';

export interface CodexUsage {
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
  prompt: string;
  description: string;
  output: string;
  status: 'success' | 'error' | 'unknown';
}

export interface CodexUsagesResponse {
  total: number;
  page: number;
  limit: number;
  items: CodexUsage[];
}

export interface WeekBucket {
  week: string;
  count: number;
}

export interface ProjectBucket {
  project: string;
  count: number;
}

export interface CodexStats {
  total: number;
  projects: ProjectBucket[];
  avg_duration_seconds: number | null;
  success_rate: number | null;
  by_week: WeekBucket[];
}

export const fetchCodexUsages = (page = 1, limit = 50, project?: string): Promise<CodexUsagesResponse> => {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (project) params.set('project', project);
  return apiFetch<CodexUsagesResponse>(`/api/codex/usages?${params}`);
};

export const fetchCodexStats = (): Promise<CodexStats> =>
  apiFetch<CodexStats>('/api/codex/stats');

export const triggerCodexScan = (): Promise<{ scanned: number; stats: CodexStats }> =>
  apiFetch('/api/codex/scan', { method: 'POST' });
