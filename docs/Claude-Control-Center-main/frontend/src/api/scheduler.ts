import { apiFetch } from './client';

export interface SchedulerAction {
  id: string;
  name: string;
  description: string;
  params: Record<string, string>;
}

export interface ScheduledTask {
  id: string;
  name: string;
  description: string;
  action: string;
  params: Record<string, unknown>;
  cron: string;
  enabled: boolean;
  quiet_guard: boolean;
  created_at: string;
  updated_at: string;
  next_run_at: string | null;
  deferred_since: string | null;
  last_run_at: string | null;
  last_status: string | null;
}

export interface SchedulerRun {
  id: string;
  task_id: string;
  task_name: string;
  action: string;
  trigger: 'cron' | 'manual';
  started_at: string;
  finished_at: string | null;
  duration_ms: number | null;
  status: 'running' | 'success' | 'error';
  result: Record<string, unknown> | null;
  error: string | null;
}

export interface SchedulerStatus {
  running: boolean;
  tick_seconds: number;
  quiet: boolean;
  quiet_window_minutes: number;
  max_defer_minutes: number;
  task_count: number;
  enabled_count: number;
}

export interface ScheduledTaskInput {
  name: string;
  action: string;
  cron: string;
  params?: Record<string, unknown>;
  enabled?: boolean;
  quiet_guard?: boolean;
  description?: string;
}

export const fetchSchedulerStatus = (): Promise<SchedulerStatus> =>
  apiFetch('/api/scheduler/status');

export const fetchSchedulerActions = (): Promise<{ actions: SchedulerAction[] }> =>
  apiFetch('/api/scheduler/actions');

export const fetchScheduledTasks = (): Promise<{ tasks: ScheduledTask[] }> =>
  apiFetch('/api/scheduler/tasks');

export const createScheduledTask = (input: ScheduledTaskInput): Promise<ScheduledTask> =>
  apiFetch('/api/scheduler/tasks', { method: 'POST', body: JSON.stringify(input) });

export const updateScheduledTask = (
  id: string,
  patch: Partial<ScheduledTaskInput>,
): Promise<ScheduledTask> =>
  apiFetch(`/api/scheduler/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });

export const deleteScheduledTask = (id: string): Promise<{ deleted: boolean }> =>
  apiFetch(`/api/scheduler/tasks/${id}`, { method: 'DELETE' });

export const runScheduledTask = (id: string): Promise<{ triggered: boolean }> =>
  apiFetch(`/api/scheduler/tasks/${id}/run`, { method: 'POST' });

export const fetchSchedulerRuns = (taskId?: string): Promise<{ runs: SchedulerRun[] }> =>
  apiFetch(`/api/scheduler/runs${taskId ? `?task_id=${taskId}` : ''}`);
