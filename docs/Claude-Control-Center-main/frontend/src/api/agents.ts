import { apiFetch } from './client';
import type { ManagedAgent, AgentEnvironment, AgentSession } from '../types';

// Status
export const fetchAgentStatus = (): Promise<{ has_api_key: boolean }> =>
  apiFetch('/api/agents/status');

// Agents CRUD
export const fetchAgents = (): Promise<ManagedAgent[]> =>
  apiFetch('/api/agents');

export const fetchAgent = (id: string): Promise<ManagedAgent> =>
  apiFetch(`/api/agents/${id}`);

export const createAgent = (data: Partial<ManagedAgent>): Promise<ManagedAgent> =>
  apiFetch('/api/agents', { method: 'POST', body: JSON.stringify(data) });

export const updateAgent = (id: string, data: Partial<ManagedAgent>): Promise<ManagedAgent> =>
  apiFetch(`/api/agents/${id}`, { method: 'PUT', body: JSON.stringify(data) });

export const deleteAgent = (id: string): Promise<{ deleted: boolean }> =>
  apiFetch(`/api/agents/${id}`, { method: 'DELETE' });

// Environments CRUD
export const fetchEnvironments = (): Promise<AgentEnvironment[]> =>
  apiFetch('/api/agents/environments');

export const fetchEnvironment = (id: string): Promise<AgentEnvironment> =>
  apiFetch(`/api/agents/environments/${id}`);

export const createEnvironment = (data: Partial<AgentEnvironment>): Promise<AgentEnvironment> =>
  apiFetch('/api/agents/environments', { method: 'POST', body: JSON.stringify(data) });

export const updateEnvironment = (id: string, data: Partial<AgentEnvironment>): Promise<AgentEnvironment> =>
  apiFetch(`/api/agents/environments/${id}`, { method: 'PUT', body: JSON.stringify(data) });

export const deleteEnvironment = (id: string): Promise<{ deleted: boolean }> =>
  apiFetch(`/api/agents/environments/${id}`, { method: 'DELETE' });

// Sessions
export const fetchSessions = (agentId?: string): Promise<AgentSession[]> => {
  const params = agentId ? `?agent_id=${agentId}` : '';
  return apiFetch(`/api/agents/sessions${params}`);
};

export const fetchSession = (id: string): Promise<AgentSession> =>
  apiFetch(`/api/agents/sessions/${id}`);

export const createSession = (data: { agent_id: string; environment_id: string }): Promise<AgentSession> =>
  apiFetch('/api/agents/sessions', { method: 'POST', body: JSON.stringify(data) });

export const sendSessionMessage = (sessionId: string, message: string): Promise<unknown> =>
  apiFetch(`/api/agents/sessions/${sessionId}/message`, {
    method: 'POST',
    body: JSON.stringify({ message }),
  });
