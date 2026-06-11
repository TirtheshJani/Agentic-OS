import { apiFetch } from './client';
import type { SessionMessages, SubagentData } from '../types';

export const fetchMessages = (projectId: string, sessionId: string) =>
  apiFetch<SessionMessages>(
    `/api/sessions/${encodeURIComponent(sessionId)}/messages?project_id=${encodeURIComponent(projectId)}`
  );

export const fetchSubagent = (projectId: string, sessionId: string, agentId: string) =>
  apiFetch<SubagentData>(
    `/api/sessions/${encodeURIComponent(sessionId)}/subagents/${encodeURIComponent(agentId)}?project_id=${encodeURIComponent(projectId)}`
  );
