import { useQuery } from '@tanstack/react-query';
import { fetchMessages, fetchSubagent } from '../api/conversations';
import { queryKeys } from '../lib/queryKeys';

export function useMessages(projectId: string | undefined, sessionId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.messages(projectId, sessionId),
    queryFn: () => fetchMessages(projectId!, sessionId!),
    enabled: !!projectId && !!sessionId,
    staleTime: 10_000,
  });
}

export function useSubagent(
  projectId: string | undefined,
  sessionId: string | undefined,
  agentId: string | null
) {
  return useQuery({
    queryKey: queryKeys.subagent(projectId, sessionId, agentId),
    queryFn: () => fetchSubagent(projectId!, sessionId!, agentId!),
    enabled: !!projectId && !!sessionId && !!agentId,
    staleTime: 60_000,
  });
}
