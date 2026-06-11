import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createWorktree,
  fetchAllWorktrees,
  fetchCommitGraph,
  fetchGitRepos,
  fetchWorktrees,
  lockWorktree,
  removeWorktree,
  unlockWorktree,
} from '../api/gitTree';
import { queryKeys } from '../lib/queryKeys';

export function useGitRepos() {
  return useQuery({
    queryKey: queryKeys.gitRepos(),
    queryFn: fetchGitRepos,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useCommitGraph(repoId: string | null, limit: number = 100) {
  return useQuery({
    queryKey: queryKeys.gitGraph(repoId ?? undefined, limit),
    queryFn: () => fetchCommitGraph(repoId!, limit),
    enabled: Boolean(repoId),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}

export function useWorktrees(repoId: string | null) {
  return useQuery({
    queryKey: queryKeys.gitWorktrees(repoId ?? undefined),
    queryFn: () => fetchWorktrees(repoId!),
    enabled: Boolean(repoId),
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  });
}

export function useAllWorktrees() {
  return useQuery({
    queryKey: queryKeys.gitAllWorktrees(),
    queryFn: fetchAllWorktrees,
    refetchInterval: 30_000,
    refetchOnWindowFocus: false,
  });
}

export function useCreateWorktree(repoId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { dest: string; branch: string; newBranch: boolean }) =>
      createWorktree(repoId!, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.gitWorktrees(repoId ?? undefined) });
      qc.invalidateQueries({ queryKey: queryKeys.gitAllWorktrees() });
    },
  });
}

export function useRemoveWorktree(repoId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { path: string; force: boolean }) =>
      removeWorktree(repoId!, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.gitWorktrees(repoId ?? undefined) });
      qc.invalidateQueries({ queryKey: queryKeys.gitAllWorktrees() });
    },
  });
}

export function useLockWorktree(repoId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { path: string; reason?: string }) =>
      lockWorktree(repoId!, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.gitWorktrees(repoId ?? undefined) });
    },
  });
}

export function useUnlockWorktree(repoId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { path: string }) => unlockWorktree(repoId!, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.gitWorktrees(repoId ?? undefined) });
    },
  });
}
