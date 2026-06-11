import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../api/client';
import { PlanProgressBadge } from './PlanProgressBadge';
import { queryKeys } from '../../lib/queryKeys';

interface PlanStep {
  id: number;
  text: string;
  checked: boolean;
  evidence?: { source?: string; session_id?: string } | null;
}

interface PlanProgress {
  steps: PlanStep[];
  completed: number;
  total: number;
}

interface Props {
  slug: string;
  readOnly?: boolean;
}

export function PlanSteps({ slug, readOnly }: Props) {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.planProgress(slug),
    queryFn: () => apiFetch<PlanProgress>(`/api/plans/${encodeURIComponent(slug)}/progress`),
    staleTime: 30_000,
    enabled: !!slug,
  });

  const { mutate: toggleStep, isPending } = useMutation({
    mutationFn: ({ stepId, checked }: { stepId: number; checked: boolean }) =>
      apiFetch(`/api/plans/${encodeURIComponent(slug)}/steps/${stepId}/toggle`, {
        method: 'POST',
        body: JSON.stringify({ checked }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.planProgress(slug) });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-2 mb-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="skeleton h-5 rounded" />
        ))}
      </div>
    );
  }

  if (!data || data.steps.length === 0) {
    return null;
  }

  return (
    <div className="mb-5">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
          Steps
        </span>
        <PlanProgressBadge completed={data.completed} total={data.total} />
      </div>
      <div
        className="rounded-md overflow-hidden"
        style={{ border: '1px solid var(--border)' }}
      >
        {data.steps.map((step, idx) => (
          <div
            key={step.id}
            className="flex items-start gap-3 px-3 py-2.5 hover:bg-white/[0.02] transition-colors"
            style={{ borderBottom: idx < data.steps.length - 1 ? '1px solid var(--border)' : undefined }}
          >
            <input
              type="checkbox"
              checked={step.checked}
              disabled={readOnly || isPending}
              onChange={(e) => toggleStep({ stepId: step.id as number, checked: e.target.checked })}
              className="mt-0.5 flex-shrink-0"
              style={{ accentColor: 'var(--accent)' }}
            />
            <div className="flex-1 min-w-0">
              <span
                className="text-xs leading-relaxed"
                style={{
                  color: step.checked ? 'var(--text-tertiary)' : 'var(--text-secondary)',
                  textDecoration: step.checked ? 'line-through' : undefined,
                }}
              >
                {step.text}
              </span>
              {step.evidence && (step.evidence.source || step.evidence.session_id) && (
                <div className="mt-0.5 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  {step.evidence.source && (
                    <span title={`Source: ${step.evidence.source}`} className="mr-2">
                      ↳ {step.evidence.source}
                    </span>
                  )}
                  {step.evidence.session_id && (
                    <span className="font-mono text-[10px]">
                      {step.evidence.session_id.slice(0, 8)}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
