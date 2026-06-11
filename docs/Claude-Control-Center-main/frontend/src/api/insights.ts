import { apiFetch } from './client';
import type { InsightsData } from '../types';

export async function fetchInsights(): Promise<InsightsData> {
  return apiFetch<InsightsData>('/api/insights');
}
