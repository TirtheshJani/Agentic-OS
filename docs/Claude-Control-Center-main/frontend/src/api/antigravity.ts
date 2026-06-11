import { apiFetch } from './client';

export interface AntigravitySessionSummary {
  session_id: string;
  project: string;
  cwd: string | null;
  task_text: string;
  first_ts: string | null;
  last_ts: string | null;
  duration_seconds: number | null;
  user_turn_count: number;
  agent_turn_count: number;
  total_tool_calls: number;
  tool_calls: Record<string, number>;
}

export interface AntigravitySessionsResponse {
  total: number;
  page: number;
  limit: number;
  items: AntigravitySessionSummary[];
}

export interface AntigravitySessionDetail {
  summary: AntigravitySessionSummary;
  events: {
    timestamp: string;
    type: string;
    payload: Record<string, unknown>;
  }[];
}

export interface AntigravityStats {
  overview: {
    total_sessions: number;
    total_tool_calls: number;
    active_days: number;
    avg_duration_seconds: number | null;
  };
  activity: {
    by_date: { date: string; sessions: number; tool_calls: number }[];
    by_hour: { hour: number; count: number }[];
  };
  tools: {
    top_tools: { name: string; count: number }[];
    total_calls: number;
  };
  projects: { project: string; sessions: number; total_tool_calls: number }[];
}

export interface AntigravityMemoryFile {
  filename: string;
  path: string;
  size: number;
  modified: number;
}

export interface AntigravitySkill {
  name: string;
  path: string;
  size: number;
  modified: number;
  executable: boolean;
}

export const fetchAntigravitySessions = ({
  page = 1,
  limit = 20,
  project,
  search,
  sort = 'newest',
}: {
  page?: number;
  limit?: number;
  project?: string;
  search?: string;
  sort?: string;
} = {}): Promise<AntigravitySessionsResponse> => {
  const params = new URLSearchParams({ page: String(page), limit: String(limit), sort });
  if (project) params.set('project', project);
  if (search) params.set('search', search);
  return apiFetch<AntigravitySessionsResponse>(`/api/antigravity/sessions?${params}`);
};

export const fetchAntigravitySession = (sessionId: string): Promise<AntigravitySessionDetail> =>
  apiFetch<AntigravitySessionDetail>(`/api/antigravity/sessions/${sessionId}`);

export const fetchAntigravitySessionStats = (days: number | 'all' = 30): Promise<AntigravityStats> =>
  apiFetch<AntigravityStats>(`/api/antigravity/sessions/stats?days=${days}`);

export const triggerAntigravityScan = (): Promise<{ scanned: number; stats: AntigravityStats }> =>
  apiFetch('/api/antigravity/sessions/scan', { method: 'POST' });

export const fetchAntigravityMemory = (): Promise<{ items: AntigravityMemoryFile[] }> =>
  apiFetch<{ items: AntigravityMemoryFile[] }>('/api/antigravity/memory');

export const fetchAntigravitySkills = (): Promise<{ items: AntigravitySkill[] }> =>
  apiFetch<{ items: AntigravitySkill[] }>('/api/antigravity/skills');

export const addAntigravitySkill = (name: string, content: string): Promise<{ success: boolean }> =>
  apiFetch<{ success: boolean }>('/api/antigravity/skills', {
    method: 'POST',
    body: JSON.stringify({ name, content }),
  });

export const deleteAntigravitySkill = (name: string): Promise<{ success: boolean }> =>
  apiFetch<{ success: boolean }>(`/api/antigravity/skills/${name}`, { method: 'DELETE' });

export const fetchAntigravitySettings = (): Promise<any> =>
  apiFetch<any>('/api/antigravity/settings');

export const updateAntigravitySettings = (settings: any): Promise<any> =>
  apiFetch<any>('/api/antigravity/settings', {
    method: 'PUT',
    body: JSON.stringify(settings),
  });
