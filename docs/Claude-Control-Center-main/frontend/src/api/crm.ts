import { apiFetch } from './client';

export type ClientType = 'US' | 'ON';
export type ClientStatus = 'prospect' | 'active' | 'churned';

export interface Client {
  client_id: string;
  name: string;
  company: string;
  type: ClientType;
  currency: string;
  hst_applicable: boolean;
  email: string;
  sector: string;
  status: ClientStatus;
  notes: string;
  created: string;
}

export interface ClientInput {
  name: string;
  company?: string;
  type?: ClientType;
  currency?: string;
  hst_applicable?: boolean;
  email?: string;
  sector?: string;
  status?: ClientStatus;
  notes?: string;
}

export interface CrmConfig {
  spreadsheet_id: string | null;
  configured: boolean;
}

export interface CrmSetupResult {
  spreadsheet_id: string;
  url: string;
}

export function fetchCrmConfig() {
  return apiFetch<CrmConfig>('/api/crm/config');
}

export function setupCrm(title?: string) {
  return apiFetch<CrmSetupResult>('/api/crm/setup', {
    method: 'POST',
    body: JSON.stringify({ title }),
  });
}

export function fetchClients() {
  return apiFetch<{ clients: Client[] }>('/api/crm/clients');
}

export function createClient(input: ClientInput) {
  return apiFetch<Client>('/api/crm/clients', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateClient(clientId: string, input: Partial<ClientInput>) {
  return apiFetch<Client>(`/api/crm/clients/${encodeURIComponent(clientId)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

// --- Deals + pipeline (Slice 2) ---------------------------------------------

export const DEAL_STAGES = ['New', 'Qualified', 'Proposal', 'Won', 'Lost'] as const;
export type DealStage = (typeof DEAL_STAGES)[number];

export interface Deal {
  deal_id: string;
  client_id: string;
  title: string;
  stage: DealStage;
  value: number;
  currency: string;
  probability: number;
  source: string;
  next_action: string;
  next_action_date: string;
  created: string;
  closed: string;
}

export interface DealInput {
  client_id: string;
  title: string;
  stage?: DealStage;
  value?: number;
  currency?: string;
  probability?: number;
  source?: string;
  next_action?: string;
  next_action_date?: string;
}

/** Per-currency aggregate, keyed by currency code (e.g. { USD: 5000, CAD: 2000 }). */
export type CurrencyTotals = Record<string, number>;

export interface PipelineStage {
  stage: DealStage;
  count: number;
  value: CurrencyTotals;
  weighted: CurrencyTotals;
}

export interface PipelineSummary {
  stages: PipelineStage[];
  totals: {
    value: CurrencyTotals;
    weighted: CurrencyTotals;
    count: number;
  };
}

export function fetchDeals() {
  return apiFetch<{ deals: Deal[] }>('/api/crm/deals');
}

export function createDeal(input: DealInput) {
  return apiFetch<Deal>('/api/crm/deals', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateDeal(dealId: string, input: Partial<DealInput>) {
  return apiFetch<Deal>(`/api/crm/deals/${encodeURIComponent(dealId)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function fetchPipeline() {
  return apiFetch<PipelineSummary>('/api/crm/pipeline');
}
