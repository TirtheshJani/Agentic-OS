import { apiFetch } from './client';

export interface McpAgentStatus {
  installed: boolean;
  path: string | null;
}

export interface McpStatus {
  claude: McpAgentStatus;
  codex: McpAgentStatus;
  gemini: McpAgentStatus;
}

export const fetchMcpStatus = (): Promise<McpStatus> =>
  apiFetch<McpStatus>('/api/mcp-bridge/status');

export const installMcp = (
  agent: 'claude' | 'codex' | 'gemini',
): Promise<{ agent: string; installed: boolean }> =>
  apiFetch<{ agent: string; installed: boolean }>(`/api/mcp-bridge/install/${agent}`, {
    method: 'POST',
  });

export const uninstallMcp = (
  agent: 'claude' | 'codex' | 'gemini',
): Promise<{ agent: string; installed: boolean }> =>
  apiFetch<{ agent: string; installed: boolean }>(`/api/mcp-bridge/uninstall/${agent}`, {
    method: 'POST',
  });
