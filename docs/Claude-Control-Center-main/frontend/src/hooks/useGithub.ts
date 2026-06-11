import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchGithubStatus,
  fetchRoots,
  fetchRepos,
  fetchBranches,
  fetchActivity,
  fetchOpenPRs,
  fetchAssignedIssues,
  fetchMilestones,
  addRoot,
  removeRoot,
  updateRoot,
  triggerRefresh,
} from '../api/github';
import type { GithubRoot } from '../types';
import { queryKeys } from '../lib/queryKeys';

export function useGithubStatus() {
  return useQuery({
    queryKey: queryKeys.githubStatus(),
    queryFn: fetchGithubStatus,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useGithubRoots() {
  return useQuery({
    queryKey: queryKeys.githubRoots(),
    queryFn: fetchRoots,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}

export function useGithubRepos() {
  return useQuery({
    queryKey: queryKeys.githubRepos(),
    queryFn: fetchRepos,
    staleTime: 120_000,
    refetchOnWindowFocus: false,
  });
}

export function useGithubBranches(repoPath: string | null) {
  return useQuery({
    queryKey: queryKeys.githubBranches(repoPath),
    queryFn: () => fetchBranches(repoPath!),
    enabled: !!repoPath,
    staleTime: 120_000,
    refetchOnWindowFocus: false,
  });
}

export function useGithubActivity(days: number = 14) {
  return useQuery({
    queryKey: queryKeys.githubActivity(days),
    queryFn: () => fetchActivity(days),
    staleTime: 120_000,
    refetchOnWindowFocus: false,
  });
}

export function useGithubPRs() {
  return useQuery({
    queryKey: queryKeys.githubPrs(),
    queryFn: fetchOpenPRs,
    staleTime: 120_000,
    refetchOnWindowFocus: false,
  });
}

export function useGithubIssues() {
  return useQuery({
    queryKey: queryKeys.githubIssues(),
    queryFn: fetchAssignedIssues,
    staleTime: 120_000,
    refetchOnWindowFocus: false,
  });
}

export function useGithubMilestones() {
  return useQuery({
    queryKey: queryKeys.githubMilestones(),
    queryFn: fetchMilestones,
    staleTime: 120_000,
    refetchOnWindowFocus: false,
  });
}

export function useAddRoot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name, path }: { name: string; path: string }) => addRoot(name, path),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.githubRoots() });
      qc.invalidateQueries({ queryKey: queryKeys.githubRepos() });
      triggerRefresh().catch(() => {});
    },
  });
}

export function useRemoveRoot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rootId: string) => removeRoot(rootId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.githubRoots() });
      qc.invalidateQueries({ queryKey: queryKeys.githubRepos() });
    },
  });
}

export function useUpdateRoot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<GithubRoot> }) => updateRoot(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.githubRoots() });
      qc.invalidateQueries({ queryKey: queryKeys.githubRepos() });
    },
  });
}
