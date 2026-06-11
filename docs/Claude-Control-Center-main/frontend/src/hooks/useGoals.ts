import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createMilestone,
  deleteMilestone,
  fetchAllGoals,
  fetchSessionGoals,
  toggleMilestone,
} from '../api/goals';
import { queryKeys } from '../lib/queryKeys';

export function useAllGoals() {
  return useQuery({
    queryKey: queryKeys.goals(),
    queryFn: fetchAllGoals,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}

export function useSessionGoals(projectId: string, sessionId: string) {
  return useQuery({
    queryKey: queryKeys.sessionGoals(projectId, sessionId),
    queryFn: () => fetchSessionGoals(projectId, sessionId),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    enabled: Boolean(projectId && sessionId),
  });
}

export function useCreateMilestone(projectId: string, sessionId: string, goalId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (text: string) => createMilestone(projectId, sessionId, goalId, text),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.sessionGoals(projectId, sessionId) });
      qc.invalidateQueries({ queryKey: queryKeys.goals() });
    },
  });
}

export function useToggleMilestone(projectId: string, sessionId: string, goalId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (milestoneId: string) =>
      toggleMilestone(projectId, sessionId, goalId, milestoneId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.sessionGoals(projectId, sessionId) });
      qc.invalidateQueries({ queryKey: queryKeys.goals() });
    },
  });
}

export function useDeleteMilestone(projectId: string, sessionId: string, goalId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (milestoneId: string) =>
      deleteMilestone(projectId, sessionId, goalId, milestoneId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.sessionGoals(projectId, sessionId) });
      qc.invalidateQueries({ queryKey: queryKeys.goals() });
    },
  });
}
