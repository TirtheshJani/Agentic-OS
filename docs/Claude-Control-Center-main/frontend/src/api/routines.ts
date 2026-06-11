import { apiFetch } from './client';

export interface RoutineUsage {
  session_id: string;
  project_dir: string;
  project: string;
  project_path: string;
  cwd: string | null;
  git_branch: string | null;
  tool_use_id: string;
  skill: string;
  args: string;
  caller_type: string;
  started_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  output: string;
  status: 'success' | 'error' | 'unknown';
}

export interface RoutineUsagesResponse {
  total: number;
  page: number;
  limit: number;
  items: RoutineUsage[];
}

export interface WeekBucket {
  week: string;
  count: number;
}

export interface ProjectBucket {
  project: string;
  count: number;
}

export interface SkillBucket {
  skill: string;
  count: number;
}

export interface RoutineStats {
  total: number;
  unique_skills: number;
  projects: ProjectBucket[];
  by_skill: SkillBucket[];
  avg_duration_seconds: number | null;
  success_rate: number | null;
  by_week: WeekBucket[];
}

export const fetchRoutineUsages = (page = 1, limit = 50, project?: string, skill?: string): Promise<RoutineUsagesResponse> => {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (project) params.set('project', project);
  if (skill) params.set('skill', skill);
  return apiFetch<RoutineUsagesResponse>(`/api/routines/usages?${params}`);
};

export const fetchRoutineStats = (): Promise<RoutineStats> =>
  apiFetch<RoutineStats>('/api/routines/stats');

export const triggerRoutineScan = (): Promise<{ scanned: number; stats: RoutineStats }> =>
  apiFetch('/api/routines/scan', { method: 'POST' });
