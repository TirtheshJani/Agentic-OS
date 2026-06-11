import { apiFetch } from './client';
import type { EvalResult, EvalStats, EvalBudget, EvalSessionsResponse } from '../types';

export async function fetchEvalSessions(
  days: number | 'all' = 30,
  tool?: string,
  grade?: string,
  page: number = 1,
  limit: number = 50,
): Promise<EvalSessionsResponse> {
  const params = new URLSearchParams({ days: String(days), page: String(page), limit: String(limit) });
  if (tool) params.set('tool', tool);
  if (grade) params.set('grade', grade);
  return apiFetch(`/api/evals/sessions?${params}`);
}

export async function fetchEvalSession(sessionId: string): Promise<EvalResult> {
  return apiFetch(`/api/evals/sessions/${sessionId}`);
}

export async function fetchEvalStats(days: number | 'all' = 30): Promise<EvalStats> {
  return apiFetch(`/api/evals/stats?days=${days}`);
}

export async function fetchEvalBudget(): Promise<EvalBudget> {
  return apiFetch('/api/evals/budget');
}

export async function gradeSession(sessionId: string): Promise<{ status: string; session_id: string }> {
  return apiFetch(`/api/evals/sessions/${sessionId}/grade`, { method: 'POST' });
}

export async function scanUngraded(limit: number = 100): Promise<{ graded: number; stats: EvalStats }> {
  return apiFetch(`/api/evals/scan?limit=${limit}`, { method: 'POST' });
}

export async function updateSessionRepo(sessionId: string, repoPath: string): Promise<{ status: string }> {
  return apiFetch(`/api/evals/sessions/${sessionId}/repo`, {
    method: 'PATCH',
    body: JSON.stringify({ repo_path: repoPath }),
  });
}
