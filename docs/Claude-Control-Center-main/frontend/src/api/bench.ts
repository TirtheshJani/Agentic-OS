import { apiFetch } from './client';
import type {
  BenchBudget,
  BenchProviders,
  BenchRun,
  BenchRunsResponse,
} from '../types';

export async function runBench(
  prompt: string,
  models: string[],
  blind = false,
): Promise<BenchRun> {
  return apiFetch('/api/bench/run', {
    method: 'POST',
    body: JSON.stringify({ prompt, models, blind }),
  });
}

export async function fetchBenchRuns(
  page = 1,
  limit = 50,
): Promise<BenchRunsResponse> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  return apiFetch(`/api/bench/runs?${params}`);
}

export async function fetchBenchRun(runId: string): Promise<BenchRun> {
  return apiFetch(`/api/bench/runs/${runId}`);
}

export async function voteBenchRun(runId: string, label: string): Promise<BenchRun> {
  return apiFetch(`/api/bench/runs/${runId}/vote`, {
    method: 'POST',
    body: JSON.stringify({ label }),
  });
}

export async function revealBenchRun(runId: string): Promise<BenchRun> {
  return apiFetch(`/api/bench/runs/${runId}/reveal`, { method: 'POST' });
}

export async function fetchBenchProviders(): Promise<BenchProviders> {
  return apiFetch('/api/bench/providers');
}

export async function fetchBenchBudget(): Promise<BenchBudget> {
  return apiFetch('/api/bench/budget');
}
