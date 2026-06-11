import { apiFetch } from './client';

export interface GeminiSessionSummary {
  session_id: string;
  filepath: string;
  cwd: string | null;
  project: string;
  git_branch: string | null;
  git_repo: string | null;
  model: string | null;
  model_provider: string | null;
  cli_version: string | null;
  source: string | null;
  first_ts: string | null;
  last_ts: string | null;
  duration_seconds: number | null;
  tool_calls: Record<string, number>;
  total_tool_calls: number;
  user_turn_count: number;
  agent_turn_count: number;
  task_text: string;
  starred: boolean;
  archived: boolean;
  note: string;
  updated_at: string | null;
}

export interface GeminiSessionsResponse {
  total: number;
  page: number;
  limit: number;
  items: GeminiSessionSummary[];
}

export interface GeminiSessionEvent {
  timestamp: string;
  type: string;
  payload: Record<string, unknown>;
}

export interface GeminiSessionDetail {
  summary: GeminiSessionSummary;
  events: GeminiSessionEvent[];
}

export type GeminiSessionSort = 'newest' | 'oldest' | 'duration' | 'tools' | 'turns';

export interface FetchGeminiSessionsParams {
  page?: number;
  limit?: number;
  project?: string;
  model?: string;
  source?: string;
  search?: string;
  sort?: GeminiSessionSort;
  starred?: boolean;
  includeArchived?: boolean;
  minTools?: number;
}

export interface GeminiStats {
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
  models: { model: string; sessions: number }[];
  projects: { project: string; sessions: number; total_tool_calls: number }[];
  days: number | null;
  session_count: number;
}

export interface GeminiSkill {
  id: string;
  name: string;
  description: string;
  short_description: string;
  has_agent: boolean;
  agent_display_name: string | null;
  agent_short_description: string | null;
  icon_small: string | null;
  icon_large: string | null;
  has_scripts: boolean;
  has_assets: boolean;
}

export interface GeminiSkillDetail extends GeminiSkill {
  body: string;
}

export interface GeminiSettings {
  projects: { path: string; trust_level: string }[];
}

export interface GeminiAnalytics {
  overview: {
    total_sessions: number;
    total_tool_calls: number;
    active_days: number;
    avg_duration_seconds: number | null;
  };
  activity: {
    by_date: { date: string; sessions: number }[];
    by_hour: { hour: number; count: number }[];
  };
  tools: { top_tools: { name: string; count: number }[] };
  models: { model: string; sessions: number }[];
  projects: { project: string; sessions: number; total_tool_calls: number }[];
}

export interface GeminiMemoryHistory {
  total: number;
  page: number;
  limit: number;
  items: { session_id: string; ts: number; text: string; datetime: string }[];
}

export interface GeminiMd {
  content: string;
  exists: boolean;
  path: string;
}

export interface ClaudeMemoryEntry {
  project: string;
  filename: string;
  name: string;
  description: string;
  body: string;
}

export const fetchGeminiSessions = ({
  page = 1,
  limit = 20,
  project,
  model,
  source,
  search,
  sort = 'newest',
  starred,
  includeArchived,
  minTools,
}: FetchGeminiSessionsParams = {}): Promise<GeminiSessionsResponse> => {
  const params = new URLSearchParams({ page: String(page), limit: String(limit), sort });
  if (project) params.set('project', project);
  if (model) params.set('model', model);
  if (source) params.set('source', source);
  if (search) params.set('search', search);
  if (starred != null) params.set('starred', String(starred));
  if (includeArchived != null) params.set('include_archived', String(includeArchived));
  if (minTools != null) params.set('min_tools', String(minTools));
  return apiFetch<GeminiSessionsResponse>(`/api/gemini/sessions?${params}`);
};

export const fetchGeminiSession = (sessionId: string): Promise<GeminiSessionDetail> =>
  apiFetch<GeminiSessionDetail>(`/api/gemini/sessions/${sessionId}`);

export const fetchGeminiSessionStats = (days: number | 'all' = 30): Promise<GeminiStats> =>
  apiFetch<GeminiStats>(`/api/gemini/sessions/stats?days=${days}`);

export const triggerGeminiScan = (): Promise<{ scanned: number; stats: GeminiStats }> =>
  apiFetch('/api/gemini/sessions/scan', { method: 'POST' });

export const fetchGeminiSkills = (): Promise<GeminiSkill[]> =>
  apiFetch<GeminiSkill[]>('/api/gemini/skills');

export const fetchGeminiSkill = (skillId: string): Promise<GeminiSkillDetail> =>
  apiFetch<GeminiSkillDetail>(`/api/gemini/skills/${skillId}`);

export const installGeminiSkill = (skillId: string): Promise<{ installed: boolean }> =>
  apiFetch<{ installed: boolean }>(`/api/gemini/skills/${skillId}/install`, { method: 'POST' });

export const uninstallGeminiSkill = (skillId: string): Promise<{ uninstalled: boolean }> =>
  apiFetch<{ uninstalled: boolean }>(`/api/gemini/skills/${skillId}/uninstall`, { method: 'POST' });

export const fetchGeminiSettings = (): Promise<GeminiSettings> =>
  apiFetch<GeminiSettings>('/api/gemini/settings');

export const updateGeminiSettings = (
  path: string,
  trustLevel: string,
): Promise<{ updated: boolean }> =>
  apiFetch<{ updated: boolean }>('/api/gemini/settings', {
    method: 'PATCH',
    body: JSON.stringify({ path, trust_level: trustLevel }),
  });

export const fetchGeminiAnalytics = (days: number | 'all' = 30): Promise<GeminiAnalytics> =>
  apiFetch<GeminiAnalytics>(`/api/gemini/analytics?days=${days}`);

export const fetchGeminiMemory = (
  page = 1,
  limit = 50,
  search = '',
): Promise<GeminiMemoryHistory> => {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (search) params.set('search', search);
  return apiFetch<GeminiMemoryHistory>(`/api/gemini/memory/history?${params}`);
};

export const fetchGeminiMd = (): Promise<GeminiMd> =>
  apiFetch<GeminiMd>('/api/gemini/memory/gemini-md');

export const updateGeminiMd = (content: string): Promise<{ saved: boolean; path: string }> =>
  apiFetch('/api/gemini/memory/gemini-md', {
    method: 'PUT',
    body: JSON.stringify({ content }),
  });

export const fetchClaudeMemories = (): Promise<{ items: ClaudeMemoryEntry[] }> =>
  apiFetch<{ items: ClaudeMemoryEntry[] }>('/api/gemini/memory/claude-memories');
