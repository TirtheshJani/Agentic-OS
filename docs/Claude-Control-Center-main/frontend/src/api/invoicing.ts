import { apiFetch } from './client';

export interface InvoicingTab {
  title: string;
  gid: number;
  rows: number | null;
  cols: number | null;
}

export interface InvoiceLineItem {
  description: string;
  qty: number | null;
  unit: number | null;
  total: number;
}

export interface InvoicePreview {
  title: string;
  client_name: string;
  line_items: InvoiceLineItem[];
  subtotal: number;
  currency: string;
  issued: string;
  sheet_total: number | null;
}

export interface CreatedInvoice {
  id: number;
  client_name: string;
  invoice_date: string | null;
  subtotal: number;
  hst_amount: number;
  total: number;
  currency: string;
  status: string;
  journal_entry_id: number | null;
  notes: string | null;
}

export interface CreateInvoiceResult {
  invoice: CreatedInvoice;
  issued: boolean;
  parsed: InvoicePreview;
}

export interface CreateInvoiceInput {
  spreadsheet?: string;
  tab: string;
  invoice_date?: string;
  client_name?: string;
  issue?: boolean;
}

export function fetchInvoicingConfig() {
  return apiFetch<{ default_spreadsheet_id: string }>('/api/invoicing/config');
}

export function fetchInvoicingTabs(spreadsheet?: string) {
  const qs = spreadsheet ? `?spreadsheet=${encodeURIComponent(spreadsheet)}` : '';
  return apiFetch<{ spreadsheet_id: string; tabs: InvoicingTab[] }>(`/api/invoicing/tabs${qs}`);
}

export function fetchInvoicePreview(spreadsheet: string, tab: string) {
  const qs = `?spreadsheet=${encodeURIComponent(spreadsheet)}&tab=${encodeURIComponent(tab)}`;
  return apiFetch<InvoicePreview>(`/api/invoicing/preview${qs}`);
}

export function createInvoice(input: CreateInvoiceInput) {
  return apiFetch<CreateInvoiceResult>('/api/invoicing/create', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
