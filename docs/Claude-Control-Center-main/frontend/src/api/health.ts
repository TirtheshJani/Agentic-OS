import { apiFetch } from './client';
import type { HealthIssue } from '../types';

export const fetchHealthReferences = () =>
  apiFetch<{ issues: HealthIssue[]; count: number }>('/api/health/references');
