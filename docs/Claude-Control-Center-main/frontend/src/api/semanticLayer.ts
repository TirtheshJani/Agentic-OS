import { apiFetch } from './client';

export type SemanticDays = 7 | 30 | 90 | 'all';

export interface SemanticMetric {
  key: string;
  label: string;
  unit: 'count' | 'tokens' | 'usd' | 'score' | string;
  aggregation: 'sum' | 'avg' | 'count' | 'max' | 'min' | string;
  grain: string;
  owner: string;
  source: string;
  description: string;
  gotchas: string;
}

export interface SemanticDimension {
  key: string;
  label: string;
  type: 'categorical' | 'temporal' | 'boolean' | string;
  source: string;
  description: string;
}

export interface SemanticProvenanceBase {
  source: string;
  source_path: string;
  freshness: string | null;
  age_seconds: number | null;
  scanner: string;
}

export interface SemanticCatalog {
  metrics: SemanticMetric[];
  dimensions: SemanticDimension[];
  hygiene: string[];
  provenance: SemanticProvenanceBase;
}

export interface SemanticQueryProvenance extends SemanticProvenanceBase {
  grain: string;
  unit: string;
  aggregation: string;
  owner: string;
  definition: string;
  gotchas: string;
  hygiene: string[];
  window_days: number | null;
  filters: Record<string, string>;
}

export interface SemanticQueryRow {
  group: string;
  value: number;
  sessions: number;
}

export interface SemanticQueryResult {
  metric: SemanticMetric;
  dimension: SemanticDimension | null;
  rows: SemanticQueryRow[];
  total: number;
  session_count: number;
  provenance: SemanticQueryProvenance;
}

export interface SemanticQueryArgs {
  metric: string;
  groupBy?: string | null;
  days?: SemanticDays;
  limit?: number;
  filters?: Record<string, string>;
}

export const fetchSemanticCatalog = (): Promise<SemanticCatalog> =>
  apiFetch<SemanticCatalog>('/api/semantic/catalog');

export const fetchSemanticQuery = ({
  metric,
  groupBy,
  days = 30,
  limit,
  filters,
}: SemanticQueryArgs): Promise<SemanticQueryResult> => {
  const params = new URLSearchParams({ metric, days: String(days) });
  if (groupBy) params.set('group_by', groupBy);
  if (limit != null) params.set('limit', String(limit));
  for (const [k, v] of Object.entries(filters ?? {})) {
    if (v) params.set(k, v);
  }
  return apiFetch<SemanticQueryResult>(`/api/semantic/query?${params.toString()}`);
};
