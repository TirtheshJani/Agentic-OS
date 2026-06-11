import { apiFetch } from './client';

export interface CodexCliSessionSummary {
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

export interface CodexCliSessionsResponse {
  total: number;
  page: number;
  limit: number;
  items: CodexCliSessionSummary[];
}

export interface CodexCliSessionEvent {
  timestamp: string;
  type: string;
  payload: Record<string, unknown>;
}

export interface CodexCliSessionDetail {
  summary: CodexCliSessionSummary;
  events: CodexCliSessionEvent[];
}

export type CodexCliSessionSort = 'newest' | 'oldest' | 'duration' | 'tools' | 'turns';

export interface FetchCodexCliSessionsParams {
  page?: number;
  limit?: number;
  project?: string;
  model?: string;
  source?: string;
  search?: string;
  sort?: CodexCliSessionSort;
  starred?: boolean;
  includeArchived?: boolean;
  minTools?: number;
}

export interface CodexCliStats {
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

export const fetchCodexCliSessions = ({
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
}: FetchCodexCliSessionsParams = {}): Promise<CodexCliSessionsResponse> => {
  const params = new URLSearchParams({ page: String(page), limit: String(limit), sort });
  if (project) params.set('project', project);
  if (model) params.set('model', model);
  if (source) params.set('source', source);
  if (search) params.set('search', search);
  if (starred != null) params.set('starred', String(starred));
  if (includeArchived != null) params.set('include_archived', String(includeArchived));
  if (minTools != null) params.set('min_tools', String(minTools));
  return apiFetch<CodexCliSessionsResponse>(`/api/codex-cli/sessions?${params}`);
};

export const fetchCodexCliSession = (sessionId: string): Promise<CodexCliSessionDetail> =>
  apiFetch<CodexCliSessionDetail>(`/api/codex-cli/sessions/${sessionId}`);

export const fetchCodexCliSessionStats = (days: number | 'all' = 30): Promise<CodexCliStats> =>
  apiFetch<CodexCliStats>(`/api/codex-cli/sessions/stats?days=${days}`);

export const triggerCodexCliScan = (): Promise<{ scanned: number; stats: CodexCliStats }> =>
  apiFetch('/api/codex-cli/sessions/scan', { method: 'POST' });

export const updateCodexCliSessionMeta = (
  sessionId: string,
  patch: Partial<Pick<CodexCliSessionSummary, 'starred' | 'archived' | 'note'>>,
): Promise<{ session_id: string; meta: Pick<CodexCliSessionSummary, 'starred' | 'archived' | 'note' | 'updated_at'> }> =>
  apiFetch(`/api/codex-cli/sessions/${encodeURIComponent(sessionId)}/meta`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
