import { apiFetch } from './client';

export interface CodexAuthStatus {
  present: boolean;
  auth_mode?: string;
  last_refresh?: string;
  has_id_token?: boolean;
  has_refresh_token?: boolean;
  account_id_present?: boolean;
  error?: string;
}

export interface CodexProjectConfig {
  path: string;
  trust_level: string;
}

export interface CodexConfig {
  projects: CodexProjectConfig[];
  error?: string;
}

export interface CodexVersion {
  latest_version: string;
  last_checked_at: string;
  dismissed_version: string | null;
}

export interface CodexModelEntry {
  id: string;
  display_name: string;
  context_window: number | null;
  has_base_instructions: boolean;
}

export interface CodexModels {
  fetched_at: string | null;
  models: CodexModelEntry[];
}

export const fetchCodexAuthStatus = (): Promise<CodexAuthStatus> =>
  apiFetch<CodexAuthStatus>('/api/codex-cli/settings/auth');

export const fetchCodexConfig = (): Promise<CodexConfig> =>
  apiFetch<CodexConfig>('/api/codex-cli/settings/config');

export const updateCodexConfig = (path: string, trust_level: string): Promise<{ updated: boolean }> =>
  apiFetch('/api/codex-cli/settings/config', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, trust_level }),
  });

export const fetchCodexVersion = (): Promise<CodexVersion> =>
  apiFetch<CodexVersion>('/api/codex-cli/settings/version');

export const fetchCodexModels = (): Promise<CodexModels> =>
  apiFetch<CodexModels>('/api/codex-cli/settings/models');
