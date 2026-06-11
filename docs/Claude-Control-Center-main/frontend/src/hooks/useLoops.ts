import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryKeys';
import {
  fetchLoops,
  fetchLoop,
  fetchLoopRuns,
  createLoop,
  updateLoop,
  deleteLoop,
  triggerLoopRun,
  installLoopCron,
  removeLoopCron,
  fetchDiscoveredCron,
  type LoopInput,
} from '../api/loops';

export function useLoops() {
  return useQuery({
    queryKey: queryKeys.loops(),
    queryFn: fetchLoops,
    staleTime: 15_000,
    refetchInterval: 15_000,
  });
}

export function useLoop(id?: string) {
  return useQuery({
    queryKey: queryKeys.loop(id),
    queryFn: () => fetchLoop(id!),
    enabled: !!id,
    staleTime: 10_000,
    refetchInterval: 10_000,
  });
}

export function useLoopRuns(id?: string) {
  return useQuery({
    queryKey: queryKeys.loopRuns(id),
    queryFn: () => fetchLoopRuns(id!),
    enabled: !!id,
    staleTime: 10_000,
    refetchInterval: 10_000,
  });
}

function useInvalidateLoops() {
  const qc = useQueryClient();
  return (id?: string) => {
    qc.invalidateQueries({ queryKey: queryKeys.loops() });
    if (id) {
      qc.invalidateQueries({ queryKey: queryKeys.loop(id) });
      qc.invalidateQueries({ queryKey: queryKeys.loopRuns(id) });
    }
  };
}

export function useCreateLoop() {
  const invalidate = useInvalidateLoops();
  return useMutation({
    mutationFn: (input: LoopInput) => createLoop(input),
    onSuccess: () => invalidate(),
  });
}

export function useUpdateLoop() {
  const invalidate = useInvalidateLoops();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<LoopInput> }) => updateLoop(id, patch),
    onSuccess: (_d, { id }) => invalidate(id),
  });
}

export function useDeleteLoop() {
  const invalidate = useInvalidateLoops();
  return useMutation({
    mutationFn: (id: string) => deleteLoop(id),
    onSuccess: () => invalidate(),
  });
}

export function useTriggerLoopRun() {
  const invalidate = useInvalidateLoops();
  return useMutation({
    mutationFn: (id: string) => triggerLoopRun(id),
    onSuccess: (_d, id) => invalidate(id),
  });
}

export function useInstallLoopCron() {
  const invalidate = useInvalidateLoops();
  return useMutation({
    mutationFn: (id: string) => installLoopCron(id),
    onSuccess: (_d, id) => invalidate(id),
  });
}

export function useRemoveLoopCron() {
  const invalidate = useInvalidateLoops();
  return useMutation({
    mutationFn: (id: string) => removeLoopCron(id),
    onSuccess: (_d, id) => invalidate(id),
  });
}

export function useDiscoveredCron() {
  return useQuery({
    queryKey: queryKeys.loopDiscovered(),
    queryFn: fetchDiscoveredCron,
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}
