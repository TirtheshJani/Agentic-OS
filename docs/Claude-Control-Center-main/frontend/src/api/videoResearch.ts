import { apiFetch } from './client';

export type VideoMode = 'single-video' | 'topic-exploration';
export type VideoFormat = 'long' | 'short';
export type VideoPhase = 'research' | 'angles' | 'synthesis' | 'done';
export type VideoJobStatus = 'pending' | 'running' | 'awaiting_pick' | 'done' | 'failed';

export interface VideoAngle {
  title: string;
  hook: string;
  audience: string;
  key_points: string[];
  format_hint?: VideoFormat;
}

export interface VideoResearchJob {
  id: string;
  slug: string;
  topic: string;
  mode: VideoMode;
  format: VideoFormat;
  vault_id: string | null;
  parent_job_id: string | null;
  picked_angle: VideoAngle | null;
  status: VideoJobStatus;
  phase: VideoPhase;
  created_at: string;
  completed_at: string | null;
  error: string | null;
  log: string;
  deliverables_path: string;
  vault_mirror_path: string | null;
}

export interface VideoSourcesStatus {
  youtube: { available: boolean };
  web: { available: boolean; configured: boolean };
  claude_cli: { available: boolean; configured: boolean };
}

export interface DeliverableContent {
  name: string;
  content: string;
  size: number;
}

export const fetchVideoJobs = (): Promise<VideoResearchJob[]> =>
  apiFetch<VideoResearchJob[]>('/api/video-research/jobs');

export const fetchVideoJob = (jobId: string): Promise<VideoResearchJob> =>
  apiFetch<VideoResearchJob>(`/api/video-research/jobs/${jobId}`);

export const createVideoJob = (params: {
  topic: string;
  mode: VideoMode;
  format: VideoFormat;
  vault_id?: string | null;
}): Promise<VideoResearchJob> =>
  apiFetch<VideoResearchJob>('/api/video-research/jobs', {
    method: 'POST',
    body: JSON.stringify(params),
  });

export const deleteVideoJob = (jobId: string): Promise<{ deleted: boolean }> =>
  apiFetch<{ deleted: boolean }>(`/api/video-research/jobs/${jobId}`, { method: 'DELETE' });

export const runVideoJob = (jobId: string): Promise<{ triggered: boolean }> =>
  apiFetch<{ triggered: boolean }>(`/api/video-research/jobs/${jobId}/run`, { method: 'POST' });

export const pickAngle = (jobId: string, angleIndex: number): Promise<VideoResearchJob> =>
  apiFetch<VideoResearchJob>(`/api/video-research/jobs/${jobId}/pick-angle`, {
    method: 'POST',
    body: JSON.stringify({ angle_index: angleIndex }),
  });

export const fetchDeliverable = (jobId: string, name: string): Promise<DeliverableContent> =>
  apiFetch<DeliverableContent>(`/api/video-research/jobs/${jobId}/deliverable/${name}`);

export const syncVideoToVault = (
  jobId: string,
  vaultId?: string,
): Promise<{ vault_id: string; path: string; files: string[] }> =>
  apiFetch(`/api/video-research/jobs/${jobId}/sync-vault`, {
    method: 'POST',
    body: JSON.stringify(vaultId ? { vault_id: vaultId } : {}),
  });

export const fetchVideoSourcesStatus = (): Promise<VideoSourcesStatus> =>
  apiFetch<VideoSourcesStatus>('/api/video-research/sources/status');
