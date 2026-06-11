import { apiFetch } from './client';
import type { DockerStack, DockerService, DockerActionResult, DockerLogsResult } from '../types';

export const fetchDockerStacks = () =>
  apiFetch<DockerStack[]>('/api/docker/stacks');

export const fetchStackDetail = (name: string) =>
  apiFetch<{ services: DockerService[] }>(`/api/docker/stacks/${encodeURIComponent(name)}/detail`);

export const stackAction = (name: string, action: 'start' | 'stop' | 'restart') =>
  apiFetch<DockerActionResult>(`/api/docker/stacks/${encodeURIComponent(name)}/${action}`, {
    method: 'POST',
  });

export const redeployStack = (name: string) =>
  apiFetch<DockerActionResult>(`/api/docker/stacks/${encodeURIComponent(name)}/redeploy`, {
    method: 'POST',
  });

export const fetchStackLogs = (name: string, lines = 200) =>
  apiFetch<DockerLogsResult>(
    `/api/docker/stacks/${encodeURIComponent(name)}/logs?lines=${lines}`
  );
