import { apiFetch } from './client';
import type { Goal, GoalMilestone, SessionGoalSummary } from '../types';

export function fetchAllGoals(): Promise<{ sessions: SessionGoalSummary[] }> {
  return apiFetch('/api/goals');
}

export function fetchSessionGoals(
  projectId: string,
  sessionId: string,
): Promise<{ goals: Goal[] }> {
  return apiFetch(`/api/goals/${encodeURIComponent(projectId)}/${encodeURIComponent(sessionId)}`);
}

export function createMilestone(
  projectId: string,
  sessionId: string,
  goalId: string,
  text: string,
): Promise<GoalMilestone> {
  return apiFetch(
    `/api/goals/${encodeURIComponent(projectId)}/${encodeURIComponent(sessionId)}/${goalId}/milestones`,
    { method: 'POST', body: JSON.stringify({ text }) },
  );
}

export function toggleMilestone(
  projectId: string,
  sessionId: string,
  goalId: string,
  milestoneId: string,
): Promise<GoalMilestone> {
  return apiFetch(
    `/api/goals/${encodeURIComponent(projectId)}/${encodeURIComponent(sessionId)}/${goalId}/milestones/${milestoneId}`,
    { method: 'PATCH', body: '{}' },
  );
}

export function deleteMilestone(
  projectId: string,
  sessionId: string,
  goalId: string,
  milestoneId: string,
): Promise<{ deleted: boolean }> {
  return apiFetch(
    `/api/goals/${encodeURIComponent(projectId)}/${encodeURIComponent(sessionId)}/${goalId}/milestones/${milestoneId}`,
    { method: 'DELETE' },
  );
}
