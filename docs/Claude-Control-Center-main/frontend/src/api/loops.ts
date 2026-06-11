import { apiFetch } from './client';

export type LoopKind = 'claude' | 'shell';

export interface GradePoint {
  run_id: string;
  at: string | null;
  session_id: string;
  composite_score: number | null;
  grade: string | null;
}

export interface LoopStats {
  loop_id: string;
  total_runs: number;
  success_rate: number | null;
  avg_duration_s: number | null;
  last_run_at: string | null;
  last_status: string | null;
  graded_runs: number;
  avg_score: number | null;
  improvement: number | null;
  grade_trend: GradePoint[];
  by_week: { week: string; count: number }[];
}

export interface Loop {
  id: string;
  name: string;
  slug: string;
  description: string;
  kind: LoopKind;
  prompt: string;
  command: string;
  cwd: string;
  schedule_cron: string;
  schedule_human: string;
  tags: string[];
  enabled: boolean;
  cron_installed: boolean;
  created_at: string;
  updated_at: string;
  cron_line?: string | null;
  stats?: LoopStats;
}

export interface LoopRun {
  run_id: string;
  loop_id: string;
  trigger: 'cron' | 'manual';
  started_at: string;
  ended_at: string | null;
  duration_s: number | null;
  session_id: string | null;
  exit_code: number | null;
  status: 'running' | 'success' | 'error';
  log_tail: string;
}

export interface LoopInput {
  name: string;
  kind?: LoopKind;
  prompt?: string;
  command?: string;
  cwd?: string;
  schedule_cron?: string;
  schedule_human?: string;
  description?: string;
  tags?: string[];
  enabled?: boolean;
}

export const fetchLoops = (): Promise<{ loops: Loop[] }> =>
  apiFetch('/api/loops');

export const fetchLoop = (id: string): Promise<Loop> =>
  apiFetch(`/api/loops/${id}`);

export const createLoop = (input: LoopInput): Promise<Loop> =>
  apiFetch('/api/loops', { method: 'POST', body: JSON.stringify(input) });

export const updateLoop = (id: string, patch: Partial<LoopInput>): Promise<Loop> =>
  apiFetch(`/api/loops/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });

export const deleteLoop = (id: string): Promise<{ deleted: boolean }> =>
  apiFetch(`/api/loops/${id}`, { method: 'DELETE' });

export const fetchLoopRuns = (id: string): Promise<{ runs: LoopRun[] }> =>
  apiFetch(`/api/loops/${id}/runs`);

export const fetchLoopStats = (id: string): Promise<LoopStats> =>
  apiFetch(`/api/loops/${id}/stats`);

export const triggerLoopRun = (id: string): Promise<{ triggered: boolean }> =>
  apiFetch(`/api/loops/${id}/run`, { method: 'POST' });

export const fetchLoopCron = (id: string): Promise<{ cron_line: string; installed: boolean }> =>
  apiFetch(`/api/loops/${id}/cron`);

export const installLoopCron = (id: string): Promise<{ installed: boolean; cron_line: string }> =>
  apiFetch(`/api/loops/${id}/cron`, { method: 'POST' });

export const removeLoopCron = (id: string): Promise<{ removed: boolean }> =>
  apiFetch(`/api/loops/${id}/cron`, { method: 'DELETE' });

export interface DiscoveredCronEntry {
  schedule: string;
  command: string;
  managed: boolean;
  loop_id: string | null;
}

export interface DiscoveredCron {
  available: boolean;
  error: string | null;
  source?: 'live' | 'host-report' | null;
  reported_at?: string | null;
  entries: DiscoveredCronEntry[];
}

export const fetchDiscoveredCron = (): Promise<DiscoveredCron> =>
  apiFetch('/api/loops/discovered');
