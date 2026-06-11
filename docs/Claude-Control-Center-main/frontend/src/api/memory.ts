import { apiFetch } from './client';
import type { MemoryFile, MemoryFileDetail } from '../types';

export const fetchMemory = (projectId: string) =>
  apiFetch<MemoryFile[]>(`/api/projects/${encodeURIComponent(projectId)}/memory`);

export const fetchMemoryFile = (projectId: string, filename: string) =>
  apiFetch<MemoryFileDetail>(
    `/api/projects/${encodeURIComponent(projectId)}/memory/${encodeURIComponent(filename)}`
  );

export interface MemoryWritePayload {
  filename: string;
  name: string;
  description: string;
  type: string;
  body: string;
}

export const createMemoryFile = (projectId: string, data: MemoryWritePayload) =>
  apiFetch<{ filename: string; created: boolean }>(
    `/api/projects/${encodeURIComponent(projectId)}/memory`,
    { method: 'POST', body: JSON.stringify(data) }
  );

export const updateMemoryFile = (
  projectId: string,
  filename: string,
  data: Partial<MemoryWritePayload>
) =>
  apiFetch<{ filename: string; updated: boolean }>(
    `/api/projects/${encodeURIComponent(projectId)}/memory/${encodeURIComponent(filename)}`,
    { method: 'PUT', body: JSON.stringify(data) }
  );

export const deleteMemoryFile = (projectId: string, filename: string) =>
  apiFetch<{ deleted: boolean }>(
    `/api/projects/${encodeURIComponent(projectId)}/memory/${encodeURIComponent(filename)}`,
    { method: 'DELETE' }
  );
