import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createVideoJob,
  deleteVideoJob,
  fetchDeliverable,
  fetchVideoJob,
  fetchVideoJobs,
  fetchVideoSourcesStatus,
  pickAngle,
  runVideoJob,
  syncVideoToVault,
  type VideoFormat,
  type VideoMode,
  type VideoResearchJob,
} from '../api/videoResearch';
import { queryKeys } from '../lib/queryKeys';

const RUNNING_STATUSES: VideoResearchJob['status'][] = ['pending', 'running'];

export function useVideoJobs() {
  return useQuery({
    queryKey: queryKeys.videoResearchJobs(),
    queryFn: fetchVideoJobs,
    staleTime: 10_000,
    refetchInterval: (query) => {
      const data = query.state.data as VideoResearchJob[] | undefined;
      return data && data.some((j) => RUNNING_STATUSES.includes(j.status)) ? 5_000 : false;
    },
  });
}

export function useVideoJob(jobId: string | null) {
  return useQuery({
    queryKey: queryKeys.videoResearchJob(jobId ?? undefined),
    queryFn: () => fetchVideoJob(jobId!),
    enabled: !!jobId,
    staleTime: 5_000,
    refetchInterval: (query) => {
      const data = query.state.data as VideoResearchJob | undefined;
      return data && RUNNING_STATUSES.includes(data.status) ? 4_000 : false;
    },
  });
}

export function useVideoDeliverable(jobId: string | null, name: string | null) {
  return useQuery({
    queryKey: queryKeys.videoResearchDeliverable(jobId ?? undefined, name ?? undefined),
    queryFn: () => fetchDeliverable(jobId!, name!),
    enabled: !!jobId && !!name,
    staleTime: 30_000,
  });
}

export function useCreateVideoJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { topic: string; mode: VideoMode; format: VideoFormat; vault_id?: string | null }) =>
      createVideoJob(params),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.videoResearchJobs() });
    },
  });
}

export function useRunVideoJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (jobId: string) => runVideoJob(jobId),
    onSuccess: (_data, jobId) => {
      qc.invalidateQueries({ queryKey: queryKeys.videoResearchJobs() });
      qc.invalidateQueries({ queryKey: queryKeys.videoResearchJob(jobId) });
    },
  });
}

export function useDeleteVideoJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (jobId: string) => deleteVideoJob(jobId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.videoResearchJobs() });
    },
  });
}

export function usePickAngle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ jobId, angleIndex }: { jobId: string; angleIndex: number }) =>
      pickAngle(jobId, angleIndex),
    onSuccess: (_data, { jobId }) => {
      qc.invalidateQueries({ queryKey: queryKeys.videoResearchJobs() });
      qc.invalidateQueries({ queryKey: queryKeys.videoResearchJob(jobId) });
    },
  });
}

export function useSyncVideoToVault() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ jobId, vaultId }: { jobId: string; vaultId?: string }) =>
      syncVideoToVault(jobId, vaultId),
    onSuccess: (_data, { jobId }) => {
      qc.invalidateQueries({ queryKey: queryKeys.videoResearchJob(jobId) });
    },
  });
}

export function useVideoSourcesStatus() {
  return useQuery({
    queryKey: queryKeys.videoResearchSourceStatus(),
    queryFn: fetchVideoSourcesStatus,
    staleTime: 60_000,
  });
}
