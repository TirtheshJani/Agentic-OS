import { apiFetch } from './client';
import type { AgentDefinition, AgentPreview, InstallResult } from '../types/agentLibrary';

export const fetchAgents = (): Promise<AgentDefinition[]> =>
  apiFetch<AgentDefinition[]>('/api/agent-library');

export const fetchAgent = (id: string): Promise<AgentDefinition> =>
  apiFetch<AgentDefinition>(`/api/agent-library/${id}`);

export const createAgent = (data: Partial<AgentDefinition>): Promise<AgentDefinition> =>
  apiFetch<AgentDefinition>('/api/agent-library', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const updateAgent = (id: string, data: Partial<AgentDefinition>): Promise<AgentDefinition> =>
  apiFetch<AgentDefinition>(`/api/agent-library/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });

export const deleteAgent = (id: string): Promise<{ ok: boolean }> =>
  apiFetch<{ ok: boolean }>(`/api/agent-library/${id}`, { method: 'DELETE' });

export const installAgent = (id: string): Promise<InstallResult> =>
  apiFetch<InstallResult>(`/api/agent-library/${id}/install`, { method: 'POST' });

export const uninstallAgent = (id: string): Promise<{ ok: boolean; agent: AgentDefinition }> =>
  apiFetch<{ ok: boolean; agent: AgentDefinition }>(`/api/agent-library/${id}/uninstall`, { method: 'POST' });

export const previewAgent = (id: string): Promise<AgentPreview> =>
  apiFetch<AgentPreview>(`/api/agent-library/${id}/preview`);

export const fetchAgentMemory = (id: string): Promise<{ content: string | null }> =>
  apiFetch<{ content: string | null }>(`/api/agent-library/${id}/memory`);
