import { useQuery } from '@tanstack/react-query';
import { fetchProjects, fetchSessions } from '../api/projects';
import { queryKeys } from '../lib/queryKeys';

export function useProjects() {
  return useQuery({
    queryKey: queryKeys.projects(),
    queryFn: fetchProjects,
    staleTime: 30_000,
  });
}

export function useSessions(projectId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.sessions(projectId),
    queryFn: () => fetchSessions(projectId!),
    enabled: !!projectId,
    staleTime: 30_000,
  });
}
