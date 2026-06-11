import { apiFetch } from './client';
import type { McpServerConfig } from '../types';

export const fetchMcpServers = (projectId?: string) =>
  apiFetch<McpServerConfig[]>(
    `/api/mcp-servers${projectId ? `?project=${encodeURIComponent(projectId)}` : ''}`
  );

export const createMcpServer = (data: Omit<McpServerConfig, 'name'> & { name: string; projectId?: string }) =>
  apiFetch<{ name: string; created: boolean }>('/api/mcp-servers', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const updateMcpServer = (name: string, data: Omit<McpServerConfig, 'name'>, projectId?: string) =>
  apiFetch<{ name: string; updated: boolean }>(
    `/api/mcp-servers/${encodeURIComponent(name)}${projectId ? `?project=${encodeURIComponent(projectId)}` : ''}`,
    { method: 'PUT', body: JSON.stringify(data) }
  );

export const deleteMcpServer = (name: string, projectId?: string) =>
  apiFetch<{ deleted: boolean }>(
    `/api/mcp-servers/${encodeURIComponent(name)}${projectId ? `?project=${encodeURIComponent(projectId)}` : ''}`,
    { method: 'DELETE' }
  );

export const promoteMcpServer = (name: string, fromProject: string) =>
  apiFetch<{ promoted: boolean; name: string }>(
    `/api/mcp-servers/${encodeURIComponent(name)}/promote`,
    { method: 'POST', body: JSON.stringify({ fromProject }) }
  );
