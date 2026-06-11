import { apiFetch } from './client';
import type { ClaudeMdFile } from '../types';

export const fetchClaudeMdFiles = () => apiFetch<ClaudeMdFile[]>('/api/claude-md');

export const fetchClaudeMdContent = (id: string) =>
  apiFetch<{ path: string; content: string }>(`/api/claude-md/${encodeURIComponent(id)}`);

export const updateClaudeMd = (id: string, content: string) =>
  apiFetch<{ updated: boolean }>(`/api/claude-md/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify({ content }),
  });

export const createClaudeMd = (path: string, content = '') =>
  apiFetch<{ id: string; created: boolean }>('/api/claude-md', {
    method: 'POST',
    body: JSON.stringify({ path, content }),
  });

export const deleteClaudeMd = (id: string) =>
  apiFetch<{ deleted: boolean }>(`/api/claude-md/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
