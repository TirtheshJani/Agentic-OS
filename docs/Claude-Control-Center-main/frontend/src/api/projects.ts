import { apiFetch } from './client';
import type { Project, Session } from '../types';

export const fetchProjects = () => apiFetch<Project[]>('/api/projects');

export const fetchSessions = (projectId: string) =>
  apiFetch<Session[]>(`/api/projects/${encodeURIComponent(projectId)}/sessions`);

export const purgeProject = (projectId: string): Promise<void> =>
  apiFetch(`/api/projects/${encodeURIComponent(projectId)}/purge`, { method: 'DELETE' });
