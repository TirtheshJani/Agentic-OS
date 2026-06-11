import { useQuery } from '@tanstack/react-query';
import { fetchAgentViewAgents } from '../api/agentView';
import { queryKeys } from '../lib/queryKeys';

export function useAgentViewAgents() {
  return useQuery({
    queryKey: queryKeys.agentViewAgents(),
    queryFn: fetchAgentViewAgents,
    refetchInterval: 30_000,
  });
}
