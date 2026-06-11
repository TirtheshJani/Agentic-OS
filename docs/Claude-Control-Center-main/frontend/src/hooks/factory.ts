/**
 * Hook factories — pair with `defineResource` to remove the boilerplate from
 * domain hook files.
 *
 * Example:
 *   const useTasks = createQueryHook(tasks.keys.list(), tasks.list, { staleTime: 30_000 });
 *   const useCreateTask = createMutationHook(tasks.create, {
 *     invalidate: [tasks.keys.all],
 *   });
 */
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
  type UseMutationOptions,
  type UseQueryOptions,
} from '@tanstack/react-query';

const DEFAULT_STALE_TIME = 30_000;

export function createQueryHook<TData>(
  key: QueryKey,
  fetcher: () => Promise<TData>,
  options?: Omit<UseQueryOptions<TData>, 'queryKey' | 'queryFn'>
) {
  return function useGeneratedQuery() {
    return useQuery<TData>({
      queryKey: key,
      queryFn: fetcher,
      staleTime: DEFAULT_STALE_TIME,
      refetchOnWindowFocus: false,
      ...options,
    });
  };
}

export interface MutationFactoryOptions<TData, TVars>
  extends Omit<UseMutationOptions<TData, Error, TVars>, 'mutationFn'> {
  invalidate?: readonly QueryKey[];
}

export function createMutationHook<TData, TVars>(
  mutationFn: (vars: TVars) => Promise<TData>,
  options?: MutationFactoryOptions<TData, TVars>
) {
  const { invalidate, onSuccess, ...rest } = options ?? {};
  return function useGeneratedMutation() {
    const qc = useQueryClient();
    return useMutation<TData, Error, TVars>({
      mutationFn,
      onSuccess: ((...args: Parameters<NonNullable<typeof onSuccess>>) => {
        if (invalidate) {
          for (const key of invalidate) {
            qc.invalidateQueries({ queryKey: key });
          }
        }
        onSuccess?.(...args);
      }) as typeof onSuccess,
      ...rest,
    });
  };
}
