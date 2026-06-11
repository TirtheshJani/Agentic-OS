import { apiFetch } from './client';
import type { DaysRange } from './analytics';

export type { DaysRange };

export type CacheWindowStatus = 'warm' | 'expiring' | 'expired' | 'unknown';

export interface CacheHitRateDay {
  date: string;
  hit_rate: number;
  cache_read: number;
  cache_creation: number;
}

export interface CacheProjectRow {
  project: string;
  hit_rate: number;
  cache_read_tokens: number;
  cache_creation_tokens: number;
  input_tokens: number;
  savings_usd: number;
  session_count: number;
  last_session_end: string | null;
  minutes_since_last_session: number | null;
  cache_window_status: CacheWindowStatus;
}

export interface ClaudeMdRow {
  project: string;
  avg_creation_per_session: number;
  avg_read_per_session: number;
  hit_rate: number;
  effective: boolean;
}

export interface CacheStats {
  global_hit_rate: number;
  total_cache_read_tokens: number;
  total_cache_creation_tokens: number;
  total_savings_usd: number;
  session_count: number;
  days: number | null;
  hit_rate_by_day: CacheHitRateDay[];
  by_project: CacheProjectRow[];
  claudemd_effectiveness: ClaudeMdRow[];
}

export interface SessionCacheStats {
  hit_rate: number;
  cache_read_tokens: number;
  cache_creation_tokens: number;
  input_tokens: number;
  savings_usd: number;
}

export const fetchCacheStats = (days: DaysRange): Promise<CacheStats> =>
  apiFetch<CacheStats>(`/api/cache/stats?days=${days}`);

export const fetchSessionCacheStats = (
  projectDir: string,
  sessionId: string
): Promise<SessionCacheStats> =>
  apiFetch<SessionCacheStats>(
    `/api/cache/session?project_dir=${encodeURIComponent(projectDir)}&session_id=${encodeURIComponent(sessionId)}`
  );
