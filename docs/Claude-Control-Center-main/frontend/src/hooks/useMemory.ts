import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchMemory,
  fetchMemoryFile,
  createMemoryFile,
  updateMemoryFile,
  deleteMemoryFile,
  type MemoryWritePayload,
} from '../api/memory';
import { queryKeys } from '../lib/queryKeys';

export function useMemoryList(projectId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.memory(projectId),
    queryFn: () => fetchMemory(projectId!),
    enabled: !!projectId,
    staleTime: 30_000,
  });
}

export function useMemoryFile(projectId: string | undefined, filename: string | undefined) {
  return useQuery({
    queryKey: queryKeys.memoryFile(projectId, filename),
    queryFn: () => fetchMemoryFile(projectId!, filename!),
    enabled: !!projectId && !!filename,
    staleTime: 30_000,
  });
}

export function useCreateMemory(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: MemoryWritePayload) => createMemoryFile(projectId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.memory(projectId) }),
  });
}

export function useUpdateMemory(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ filename, data }: { filename: string; data: Partial<MemoryWritePayload> }) =>
      updateMemoryFile(projectId, filename, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.memory(projectId) }),
  });
}

export function useDeleteMemory(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (filename: string) => deleteMemoryFile(projectId, filename),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.memory(projectId) }),
  });
}
