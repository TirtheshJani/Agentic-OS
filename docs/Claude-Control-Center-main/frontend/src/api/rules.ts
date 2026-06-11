import { apiFetch } from './client';
import type { RulesData } from '../types';

export const fetchRules = () => apiFetch<RulesData>('/api/rules');

export const addRule = (listType: 'allow' | 'deny', pattern: string) =>
  apiFetch<{ added: boolean; pattern: string }>(`/api/rules/${listType}`, {
    method: 'POST',
    body: JSON.stringify({ pattern }),
  });

export const deleteRule = (listType: 'allow' | 'deny', index: number) =>
  apiFetch<{ deleted: boolean; pattern: string }>(`/api/rules/${listType}/${index}`, {
    method: 'DELETE',
  });
