import { apiFetch } from './client';

export interface AgentViewAgent {
  name: string;
  slug: string;
  description: string;
  tools: string[];
  filePath: string;
  isActive: boolean;
}

export async function fetchAgentViewAgents(): Promise<AgentViewAgent[]> {
  return apiFetch('/api/agent-view/agents');
}

export async function interruptAgent(name: string): Promise<{ status: string; message: string }> {
  return apiFetch(`/api/agent-view/agents/${encodeURIComponent(name)}/interrupt`, { method: 'POST' });
}
