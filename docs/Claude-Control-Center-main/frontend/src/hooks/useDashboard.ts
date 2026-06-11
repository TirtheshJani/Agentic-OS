import { useQuery } from '@tanstack/react-query';
import { fetchFleet } from '../api/dashboard';
import { queryKeys } from '../lib/queryKeys';

export function useFleet() {
  return useQuery({
    queryKey: queryKeys.dashboardFleet(),
    queryFn: fetchFleet,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}
