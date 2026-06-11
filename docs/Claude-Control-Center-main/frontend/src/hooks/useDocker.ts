import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchDockerStacks,
  fetchStackDetail,
  fetchStackLogs,
  redeployStack,
  stackAction,
} from '../api/docker';
import { queryKeys } from '../lib/queryKeys';

export function useDockerStacks() {
  return useQuery({
    queryKey: queryKeys.dockerStacks(),
    queryFn: fetchDockerStacks,
    staleTime: 10_000,
  });
}

export function useStackDetail(name: string | null) {
  return useQuery({
    queryKey: queryKeys.dockerDetail(name ?? undefined),
    queryFn: () => fetchStackDetail(name!),
    enabled: !!name,
    staleTime: 5_000,
  });
}

export function useStackLogs(name: string | null, lines = 200, enabled = false) {
  return useQuery({
    queryKey: queryKeys.dockerLogs(name ?? undefined, lines),
    queryFn: () => fetchStackLogs(name!, lines),
    enabled: enabled && !!name,
    staleTime: 0,
  });
}

export function useStackAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name, action }: { name: string; action: 'start' | 'stop' | 'restart' }) =>
      stackAction(name, action),
    onSuccess: (_data, { name }) => {
      qc.invalidateQueries({ queryKey: queryKeys.dockerStacks() });
      qc.invalidateQueries({ queryKey: queryKeys.dockerDetail(name) });
    },
  });
}

export function useRedeployStack() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => redeployStack(name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.dockerStacks() });
    },
  });
}
