import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createInvoice,
  fetchInvoicePreview,
  fetchInvoicingConfig,
  fetchInvoicingTabs,
} from '../api/invoicing';
import type { CreateInvoiceInput } from '../api/invoicing';
import { queryKeys } from '../lib/queryKeys';

export function useInvoicingConfig() {
  return useQuery({
    queryKey: queryKeys.invoicingConfig(),
    queryFn: fetchInvoicingConfig,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
}

export function useInvoicingTabs(spreadsheet: string | undefined) {
  return useQuery({
    queryKey: queryKeys.invoicingTabs(spreadsheet),
    queryFn: () => fetchInvoicingTabs(spreadsheet),
    enabled: !!spreadsheet,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useInvoicePreview(spreadsheet: string | undefined, tab: string | undefined) {
  return useQuery({
    queryKey: queryKeys.invoicePreview(spreadsheet, tab),
    queryFn: () => fetchInvoicePreview(spreadsheet!, tab!),
    enabled: !!spreadsheet && !!tab,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}

export function useCreateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateInvoiceInput) => createInvoice(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.invoicingTabs(undefined) });
    },
  });
}
