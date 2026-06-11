import { apiFetch } from './client';

export interface FleetAgent {
  id: 'claude' | 'codex' | 'gemini';
  label: string;
  active: number;
  queued: number;
  failed: number;
  idle: number;
  value_24h: number;
  value_7d: number;
  value_unit: 'tokens' | 'tool calls';
  sparkline: number[];
  session_count_7d: number;
}

export interface FleetActiveSession {
  agent: 'claude' | 'codex' | 'gemini';
  kind: string;
  pid: number;
  sessionId: string;
  cwd: string;
  project: string;
  startedAt: number;
  isAlive: boolean;
  lastTs?: string;
  model?: string | null;
  bridgeSessionId?: string | null;
}

export interface FleetResponse {
  agents: FleetAgent[];
  active_sessions: FleetActiveSession[];
  dates: string[];
  generated_at: number;
}

export const fetchFleet = (): Promise<FleetResponse> =>
  apiFetch<FleetResponse>('/api/dashboard/fleet');
