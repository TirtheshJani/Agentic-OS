import { apiFetch } from './client';
import type { HooksData } from '../types';

export interface CodexHook {
  name: string;
  path: string;
  size: number;
  mtime: number;
}

export async function fetchCodexHooks(): Promise<{ hooks: CodexHook[]; available: boolean }> {
  return apiFetch('/api/hooks/codex');
}

export const fetchHooks = (projectId?: string) =>
  apiFetch<HooksData>(
    `/api/hooks${projectId ? `?project=${encodeURIComponent(projectId)}` : ''}`
  );

export const createHook = (event: string, data: { matcher: string; command: string; projectId?: string }) =>
  apiFetch<{ event: string; created: boolean }>(`/api/hooks/${event}`, {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const updateHook = (
  event: string,
  index: number,
  data: { matcher?: string; command?: string },
  projectId?: string
) =>
  apiFetch<{ updated: boolean }>(
    `/api/hooks/${event}/${index}${projectId ? `?project=${encodeURIComponent(projectId)}` : ''}`,
    { method: 'PUT', body: JSON.stringify(data) }
  );

export const deleteHook = (event: string, index: number, projectId?: string) =>
  apiFetch<{ deleted: boolean }>(
    `/api/hooks/${event}/${index}${projectId ? `?project=${encodeURIComponent(projectId)}` : ''}`,
    { method: 'DELETE' }
  );

export const promoteHook = (event: string, index: number, fromProject: string) =>
  apiFetch<{ promoted: boolean }>(
    `/api/hooks/${event}/${index}/promote`,
    { method: 'POST', body: JSON.stringify({ fromProject }) }
  );
