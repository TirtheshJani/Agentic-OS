import { useQuery } from '@tanstack/react-query';
import { fetchCacheStats, fetchSessionCacheStats } from '../api/cache';
import { queryKeys } from '../lib/queryKeys';
import type { DaysRange } from '../api/cache';

export function useCacheStats(days: DaysRange) {
  return useQuery({
    queryKey: queryKeys.cacheStats(days),
    queryFn: () => fetchCacheStats(days),
    staleTime: 5 * 60 * 1000,
    refetchInterval: 60_000,
  });
}

export function useSessionCacheStats(projectDir?: string, sessionId?: string) {
  return useQuery({
    queryKey: queryKeys.sessionCacheStats(projectDir, sessionId),
    queryFn: () => fetchSessionCacheStats(projectDir!, sessionId!),
    enabled: !!projectDir && !!sessionId,
    staleTime: 60_000,
    retry: false,
  });
}
