import { apiFetch } from './client';
import type { Plan, PlanDetail } from '../types';

export const fetchPlans = () => apiFetch<Plan[]>('/api/plans');
export const fetchPlan = (slug: string) => apiFetch<PlanDetail>(`/api/plans/${encodeURIComponent(slug)}`);
