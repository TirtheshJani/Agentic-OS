import { apiFetch } from './client';

export interface GwsStatus {
  binary_found: boolean;
  binary_path: string | null;
  version: string | null;
  port: number;
}

export interface GwsExecuteResult {
  stdout: string;
  stderr: string;
  returncode: number;
  duration_ms: number;
  truncated: boolean;
  error?: string;
  streaming?: boolean;
  stream_url?: string;
}

export interface GwsAuditRecord {
  ts: string;
  source: string;
  service: string;
  full_args: string[];
  returncode: number;
  duration_ms: number;
  output_snippet: string;
  error_snippet?: string;
}

export interface GwsSnapshotSection {
  items: unknown[];
  error?: string;
  auth_error?: boolean;
  raw?: string;
  tasklists?: unknown[];
  active_list?: Record<string, string>;
}

export interface GwsSnapshot {
  refreshed_at?: string;
  inbox?: GwsSnapshotSection;
  agenda?: GwsSnapshotSection;
  tasks?: GwsSnapshotSection;
  drive?: GwsSnapshotSection;
}

export interface GwsRecipeInput {
  key: string;
  label: string;
  flag: string;
}

export interface GwsRecipe {
  id: string;
  name: string;
  description?: string;
  args: string[];
  streaming: boolean;
  builtin: boolean;
  enabled: boolean;
  requires_input?: GwsRecipeInput[];
}

export const fetchGwsStatus = () => apiFetch<GwsStatus>('/api/gws/status');

export const fetchGwsSnapshot = () => apiFetch<GwsSnapshot>('/api/gws/snapshot');

export const refreshGwsSnapshot = () =>
  apiFetch<GwsSnapshot>('/api/gws/snapshot/refresh', { method: 'POST' });

export const executeGwsCommand = (args: string[], source = 'manual') =>
  apiFetch<GwsExecuteResult>('/api/gws/execute', {
    method: 'POST',
    body: JSON.stringify({ args, source }),
  });

export const fetchGwsAudit = (limit = 100) =>
  apiFetch<GwsAuditRecord[]>(`/api/gws/audit?limit=${limit}`);

export const clearGwsAudit = () =>
  apiFetch<{ cleared: boolean }>('/api/gws/audit', { method: 'DELETE' });

export const fetchGwsRecipes = () => apiFetch<GwsRecipe[]>('/api/gws/recipes');

export const runGwsRecipe = (id: string, inputs?: Record<string, string>) =>
  apiFetch<GwsExecuteResult>(`/api/gws/recipes/${id}/run`, {
    method: 'POST',
    body: JSON.stringify({ inputs: inputs ?? {} }),
  });

export const updateGwsRecipe = (id: string, data: Partial<GwsRecipe>) =>
  apiFetch<GwsRecipe>(`/api/gws/recipes/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });

export const createGwsRecipe = (data: Omit<GwsRecipe, 'builtin'>) =>
  apiFetch<GwsRecipe>('/api/gws/recipes', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const deleteGwsRecipe = (id: string) =>
  apiFetch<{ deleted: string }>(`/api/gws/recipes/${id}`, { method: 'DELETE' });

// ---------------------------------------------------------------------------
// Codex Bridge (Phase 5)
// ---------------------------------------------------------------------------

export interface GwsBridgeStatus {
  installed: boolean;
  path: string | null;
  modified_externally: boolean;
}

export const fetchGwsBridgeStatus = () =>
  apiFetch<GwsBridgeStatus>('/api/gws/codex-bridge');

export const installGwsBridge = () =>
  apiFetch<{ installed: boolean; path: string }>('/api/gws/codex-bridge', { method: 'POST' });

export const uninstallGwsBridge = () =>
  apiFetch<{ uninstalled: boolean; reason?: string }>('/api/gws/codex-bridge', { method: 'DELETE' });

// ---------------------------------------------------------------------------
// Activity Log (Phase 6)
// ---------------------------------------------------------------------------

export interface GwsActivityRecord {
  id: string;
  source: string;
  service: string;
  full_args: string[];
  command_summary: string;
  started_at: string;
  duration_ms: number | null;
  status: 'ok' | 'error' | 'unknown';
  output_snippet: string;
  session_id: string | null;
  project: string | null;
}

export interface GwsActivityPage {
  scanned_at: string | null;
  total: number;
  page: number;
  limit: number;
  records: GwsActivityRecord[];
}

export const fetchGwsActivity = (params?: { limit?: number; page?: number; source?: string; service?: string }) => {
  const q = new URLSearchParams();
  if (params?.limit) q.set('limit', String(params.limit));
  if (params?.page) q.set('page', String(params.page));
  if (params?.source) q.set('source', params.source);
  if (params?.service) q.set('service', params.service);
  const qs = q.toString();
  return apiFetch<GwsActivityPage>(`/api/gws/activity${qs ? `?${qs}` : ''}`);
};

export const triggerGwsActivityScan = () =>
  apiFetch<{ scanned: number }>('/api/gws/activity/scan', { method: 'POST' });
