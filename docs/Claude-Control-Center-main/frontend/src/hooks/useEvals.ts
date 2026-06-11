import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryKeys';
import {
  fetchEvalSessions,
  fetchEvalSession,
  fetchEvalStats,
  fetchEvalBudget,
  gradeSession,
  scanUngraded,
  updateSessionRepo,
} from '../api/evals';

export function useEvalSessions(
  days: number | 'all' = 30,
  tool?: string,
  grade?: string,
  page: number = 1,
) {
  return useQuery({
    queryKey: queryKeys.evalSessions(days, tool, grade, page),
    queryFn: () => fetchEvalSessions(days, tool, grade, page),
    staleTime: 60_000,
  });
}

export function useEvalSession(sessionId?: string) {
  return useQuery({
    queryKey: queryKeys.evalSession(sessionId),
    queryFn: () => fetchEvalSession(sessionId!),
    enabled: !!sessionId,
    staleTime: 30_000,
  });
}

export function useEvalStats(days: number | 'all' = 30) {
  return useQuery({
    queryKey: queryKeys.evalStats(days),
    queryFn: () => fetchEvalStats(days),
    staleTime: 60_000,
  });
}

export function useEvalBudget() {
  return useQuery({
    queryKey: queryKeys.evalBudget(),
    queryFn: fetchEvalBudget,
    staleTime: 30_000,
  });
}

export function useGradeSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) => gradeSession(sessionId),
    onSuccess: (_data, sessionId) => {
      qc.invalidateQueries({ queryKey: queryKeys.evalSession(sessionId) });
      qc.invalidateQueries({ queryKey: ['eval-sessions'] });
      qc.invalidateQueries({ queryKey: ['eval-stats'] });
    },
  });
}

export function useScanUngraded() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (limit?: number) => scanUngraded(limit),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['eval-sessions'] });
      qc.invalidateQueries({ queryKey: ['eval-stats'] });
    },
  });
}

export function useUpdateSessionRepo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sessionId, repoPath }: { sessionId: string; repoPath: string }) =>
      updateSessionRepo(sessionId, repoPath),
    onSuccess: (_data, { sessionId }) => {
      qc.invalidateQueries({ queryKey: queryKeys.evalSession(sessionId) });
    },
  });
}
