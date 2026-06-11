import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createClient,
  createDeal,
  fetchClients,
  fetchCrmConfig,
  fetchDeals,
  fetchPipeline,
  setupCrm,
  updateClient,
  updateDeal,
} from '../api/crm';
import type { ClientInput, DealInput } from '../api/crm';
import { queryKeys } from '../lib/queryKeys';

export function useCrmConfig() {
  return useQuery({
    queryKey: queryKeys.crmConfig(),
    queryFn: fetchCrmConfig,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useClients() {
  return useQuery({
    queryKey: queryKeys.crmClients(),
    queryFn: fetchClients,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}

export function useSetupCrm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (title?: string) => setupCrm(title),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.crmConfig() });
    },
  });
}

export function useCreateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ClientInput) => createClient(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.crmClients() });
    },
  });
}

export function useUpdateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ clientId, input }: { clientId: string; input: Partial<ClientInput> }) =>
      updateClient(clientId, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.crmClients() });
    },
  });
}

// --- Deals + pipeline (Slice 2) ---------------------------------------------

export function useDeals() {
  return useQuery({
    queryKey: queryKeys.crmDeals(),
    queryFn: fetchDeals,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}

export function usePipeline() {
  return useQuery({
    queryKey: queryKeys.crmPipeline(),
    queryFn: fetchPipeline,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}

function invalidateDeals(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: queryKeys.crmDeals() });
  qc.invalidateQueries({ queryKey: queryKeys.crmPipeline() });
}

export function useCreateDeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: DealInput) => createDeal(input),
    onSuccess: () => invalidateDeals(qc),
  });
}

export function useUpdateDeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ dealId, input }: { dealId: string; input: Partial<DealInput> }) =>
      updateDeal(dealId, input),
    onSuccess: () => invalidateDeals(qc),
  });
}
