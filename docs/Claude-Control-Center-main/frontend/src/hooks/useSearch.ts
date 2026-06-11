import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchSearch } from '../api/search';
import { queryKeys } from '../lib/queryKeys';

const MIN_CHARS = 3;
const DEBOUNCE_MS = 300;

/** Debounce a fast-changing value. */
export function useDebounced<T>(value: T, delay = DEBOUNCE_MS): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export function useSearch(rawQuery: string) {
  const query = useDebounced(rawQuery.trim());
  const enabled = query.length >= MIN_CHARS;
  return useQuery({
    queryKey: queryKeys.search(query),
    queryFn: () => fetchSearch(query),
    enabled,
    staleTime: 10_000,
  });
}
