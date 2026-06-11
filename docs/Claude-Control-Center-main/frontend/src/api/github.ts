import { apiFetch } from './client';
import type {
  GithubStatus,
  GithubRoot,
  DiscoveredRepo,
  LocalBranch,
  CommitActivity,
  GithubPRsResponse,
  GithubIssuesResponse,
  GithubMilestonesResponse,
} from '../types';

export const fetchGithubStatus = (): Promise<GithubStatus> =>
  apiFetch('/api/github/status');

export const fetchRoots = (): Promise<GithubRoot[]> =>
  apiFetch('/api/github/roots');

export const addRoot = (name: string, path: string): Promise<GithubRoot> =>
  apiFetch('/api/github/roots', {
    method: 'POST',
    body: JSON.stringify({ name, path }),
  });

export const removeRoot = (rootId: string): Promise<{ removed: boolean }> =>
  apiFetch(`/api/github/roots/${rootId}`, { method: 'DELETE' });

export const updateRoot = (rootId: string, data: Partial<GithubRoot>): Promise<GithubRoot> =>
  apiFetch(`/api/github/roots/${rootId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });

export const fetchRepos = (): Promise<DiscoveredRepo[]> =>
  apiFetch('/api/github/repos');

export const fetchBranches = (repoPath: string): Promise<LocalBranch[]> =>
  apiFetch(`/api/github/branches?repo=${encodeURIComponent(repoPath)}`);

export const fetchActivity = (days = 14): Promise<CommitActivity[]> =>
  apiFetch(`/api/github/activity?days=${days}`);

export const fetchOpenPRs = (): Promise<GithubPRsResponse> =>
  apiFetch('/api/github/prs');

export const fetchAssignedIssues = (): Promise<GithubIssuesResponse> =>
  apiFetch('/api/github/issues');

export const fetchMilestones = (): Promise<GithubMilestonesResponse> =>
  apiFetch('/api/github/milestones');

export const triggerRefresh = (): Promise<{ queued: boolean }> =>
  apiFetch('/api/github/refresh', { method: 'POST' });
