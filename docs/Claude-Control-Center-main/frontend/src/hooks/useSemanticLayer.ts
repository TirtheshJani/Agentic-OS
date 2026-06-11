import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryKeys';
import {
  fetchSemanticCatalog,
  fetchSemanticQuery,
  type SemanticDays,
  type SemanticQueryArgs,
} from '../api/semanticLayer';

export function useSemanticCatalog() {
  return useQuery({
    queryKey: queryKeys.semanticCatalog(),
    queryFn: fetchSemanticCatalog,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useSemanticQuery(args: SemanticQueryArgs, enabled = true) {
  const { metric, groupBy, days = 30 as SemanticDays, filters } = args;
  const filterKey = filters ? JSON.stringify(filters) : undefined;
  return useQuery({
    queryKey: queryKeys.semanticQuery(metric, groupBy, days, filterKey),
    queryFn: () => fetchSemanticQuery(args),
    enabled: enabled && !!metric,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}
