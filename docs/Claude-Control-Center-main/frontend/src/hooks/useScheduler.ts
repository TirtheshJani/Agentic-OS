import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryKeys';
import {
  createScheduledTask,
  deleteScheduledTask,
  fetchScheduledTasks,
  fetchSchedulerActions,
  fetchSchedulerRuns,
  fetchSchedulerStatus,
  runScheduledTask,
  updateScheduledTask,
  type ScheduledTaskInput,
} from '../api/scheduler';

export function useSchedulerStatus() {
  return useQuery({
    queryKey: queryKeys.schedulerStatus(),
    queryFn: fetchSchedulerStatus,
    staleTime: 15_000,
    refetchInterval: 15_000,
  });
}

export function useSchedulerActions() {
  return useQuery({
    queryKey: queryKeys.schedulerActions(),
    queryFn: fetchSchedulerActions,
    staleTime: Infinity,
  });
}

export function useScheduledTasks() {
  return useQuery({
    queryKey: queryKeys.schedulerTasks(),
    queryFn: fetchScheduledTasks,
    staleTime: 15_000,
    refetchInterval: 15_000,
  });
}

export function useSchedulerRuns(taskId?: string) {
  return useQuery({
    queryKey: queryKeys.schedulerRuns(taskId),
    queryFn: () => fetchSchedulerRuns(taskId),
    staleTime: 10_000,
    refetchInterval: 10_000,
  });
}

function useInvalidateScheduler() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: queryKeys.schedulerTasks() });
    qc.invalidateQueries({ queryKey: queryKeys.schedulerStatus() });
    qc.invalidateQueries({ queryKey: ['scheduler-runs'] });
  };
}

export function useCreateScheduledTask() {
  const invalidate = useInvalidateScheduler();
  return useMutation({
    mutationFn: (input: ScheduledTaskInput) => createScheduledTask(input),
    onSuccess: () => invalidate(),
  });
}

export function useUpdateScheduledTask() {
  const invalidate = useInvalidateScheduler();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<ScheduledTaskInput> }) =>
      updateScheduledTask(id, patch),
    onSuccess: () => invalidate(),
  });
}

export function useDeleteScheduledTask() {
  const invalidate = useInvalidateScheduler();
  return useMutation({
    mutationFn: (id: string) => deleteScheduledTask(id),
    onSuccess: () => invalidate(),
  });
}

export function useRunScheduledTask() {
  const invalidate = useInvalidateScheduler();
  return useMutation({
    mutationFn: (id: string) => runScheduledTask(id),
    onSuccess: () => invalidate(),
  });
}
