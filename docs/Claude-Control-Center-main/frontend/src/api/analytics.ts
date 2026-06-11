import { apiFetch } from './client';

export type DaysRange = 7 | 30 | 90 | 'all';

export interface AnalyticsDayBucket {
  date: string;
  input: number;
  output: number;
  messages: number;
}

export interface AnalyticsHourBucket {
  hour: number;
  count: number;
}

export interface AnalyticsDateBucket {
  date: string;
  sessions: number;
  messages: number;
}

export interface AnalyticsOverview {
  total_sessions: number;
  total_messages: number;
  total_tool_calls: number;
  plan_sessions: number;
  regular_sessions: number;
  active_days: number;
}

export interface AnalyticsTokens {
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_creation_tokens: number;
  by_day: AnalyticsDayBucket[];
}

export interface AnalyticsActivity {
  by_hour: AnalyticsHourBucket[];
  by_date: AnalyticsDateBucket[];
}

export interface AnalyticsTool {
  name: string;
  count: number;
}

export interface AnalyticsTools {
  top_tools: AnalyticsTool[];
  total_calls: number;
}

export interface AnalyticsModel {
  model: string;
  messages: number;
  tokens: number;
}

export interface AnalyticsProject {
  project: string;
  sessions: number;
  messages: number;
  tokens: number;
}

export interface AnalyticsInsight {
  type: string;
  title: string;
  description: string;
  severity: 'info' | 'warning';
  data: Record<string, unknown>;
}

export interface AnalyticsFeatureUsage {
  auto_mode_sessions: number;
  computer_use_sessions: number;
  ultraplan_sessions: number;
  computer_use_calls: number;
  permission_mode_breakdown: Record<string, number>;
}

export interface QualityDistribution {
  high: number;
  medium: number;
  low: number;
}

export interface QualitySignals {
  verification_pct: number;
  auto_pct: number;
  plan_pct: number;
}

export interface QualityByProject {
  project: string;
  avg_score: number;
  sessions: number;
}

export interface AnalyticsQuality {
  avg_score: number;
  distribution: QualityDistribution;
  signals: QualitySignals;
  by_project: QualityByProject[];
}

export interface AnalyticsStats {
  overview: AnalyticsOverview;
  tokens: AnalyticsTokens;
  activity: AnalyticsActivity;
  tools: AnalyticsTools;
  models: AnalyticsModel[];
  projects: AnalyticsProject[];
  feature_usage: AnalyticsFeatureUsage;
  session_quality: AnalyticsQuality;
  insights: AnalyticsInsight[];
  days: number | null;
  session_count: number;
}

export const fetchAnalyticsStats = (days: DaysRange): Promise<AnalyticsStats> =>
  apiFetch<AnalyticsStats>(`/api/analytics/stats?days=${days}`);

export const triggerAnalyticsScan = (days: DaysRange): Promise<{ scanned: number; stats: AnalyticsStats }> =>
  apiFetch(`/api/analytics/scan?days=${days}`, { method: 'POST' });

// ---------------------------------------------------------------------------
// Codeburn types & API
// ---------------------------------------------------------------------------

export interface CodeburnCostByDay {
  date: string;
  cost_usd: number;
}

export interface CodeburnCostByModel {
  model: string;
  cost_usd: number;
  sessions: number;
}

export interface CodeburnCostByProject {
  project: string;
  cost_usd: number;
  sessions: number;
}

export interface CodeburnCategory {
  category: string;
  label: string;
  count: number;
  cost_usd: number;
}

export interface CodeburnCacheEfficiency {
  cache_hit_pct: number;
  tokens_saved: number;
  cost_saved_usd: number;
}

export interface CodeburnInsight {
  type: string;
  title: string;
  description: string;
  severity: 'info' | 'warning';
  data: Record<string, unknown>;
}

export interface CodeburnStats {
  total_cost_usd: number;
  cost_by_day: CodeburnCostByDay[];
  cost_by_model: CodeburnCostByModel[];
  cost_by_project: CodeburnCostByProject[];
  task_categories: CodeburnCategory[];
  cache_efficiency: CodeburnCacheEfficiency;
  cost_insights: CodeburnInsight[];
  exchange_rate: number;
  display_currency: string;
  days: number | null;
  session_count: number;
}

export const fetchCodeburnStats = (days: DaysRange): Promise<CodeburnStats> =>
  apiFetch<CodeburnStats>(`/api/analytics/codeburn?days=${days}`);
