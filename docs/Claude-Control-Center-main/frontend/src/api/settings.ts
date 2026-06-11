import { apiFetch } from './client';
import type { Plugin, Command, ActiveSession, Task, Skill } from '../types';

export interface GatewayModel {
  id: string;
  created: number;
  owned_by: string;
}

export async function fetchGatewayModels(): Promise<{ models: GatewayModel[]; baseUrl: string; error?: string }> {
  return apiFetch('/api/settings/gateway-models');
}

export const fetchSettings = () => apiFetch<Record<string, unknown>>('/api/settings');

export const updateSettings = (data: Record<string, unknown>) =>
  apiFetch<{ updated: boolean }>('/api/settings', { method: 'PUT', body: JSON.stringify(data) });

export const fetchPlugins = () => apiFetch<Plugin[]>('/api/plugins');

export const togglePlugin = (pluginId: string, enabled: boolean) =>
  apiFetch<{ updated: boolean; enabled: boolean }>(
    `/api/plugins/${encodeURIComponent(pluginId)}/toggle`,
    { method: 'PUT', body: JSON.stringify({ enabled }) }
  );

export const fetchCommands = () => apiFetch<Command[]>('/api/commands');

export const createCommand = (data: Omit<Command, 'filename'> & { name: string }) =>
  apiFetch<{ filename: string; created: boolean }>('/api/commands', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const updateCommand = (filename: string, data: Partial<Command>) =>
  apiFetch<{ filename: string; updated: boolean }>(`/api/commands/${encodeURIComponent(filename)}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });

export const deleteCommand = (filename: string) =>
  apiFetch<{ deleted: boolean }>(`/api/commands/${encodeURIComponent(filename)}`, {
    method: 'DELETE',
  });

export const fetchSkills = () => apiFetch<Skill[]>('/api/skills');

export const createSkill = (data: { name: string; description?: string; body?: string }) =>
  apiFetch<{ id: string; created: boolean }>('/api/skills', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const deleteSkill = (skillId: string) =>
  apiFetch<{ deleted: boolean }>(`/api/skills/${encodeURIComponent(skillId)}`, {
    method: 'DELETE',
  });

export const fetchActiveSessions = () => apiFetch<ActiveSession[]>('/api/active-sessions');

export const fetchTasks = () => apiFetch<Task[]>('/api/tasks');
