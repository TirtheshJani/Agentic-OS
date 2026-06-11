import { useNavigate, useParams } from 'react-router-dom';
import { FileText } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { fetchPlans } from '../../api/plans';
import { relativeTime, truncate } from '../../lib/utils';
import { cn } from '../../lib/utils';
import { queryKeys } from '../../lib/queryKeys';

export function PlanList() {
  const { slug: activeSlug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { data: plans, isLoading } = useQuery({
    queryKey: queryKeys.plans(),
    queryFn: fetchPlans,
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="space-y-1 p-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="skeleton h-12 rounded-md" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-1 p-3">
      {plans?.map((plan) => (
        <button
          key={plan.slug}
          onClick={() => navigate(`/plans/${encodeURIComponent(plan.slug)}`)}
          className={cn(
            'w-full text-left px-3 py-2.5 rounded-md transition-all duration-100',
            activeSlug === plan.slug
              ? 'bg-[var(--accent-dim)] border border-[var(--border-hover)]'
              : 'hover:bg-white/[0.04]'
          )}
        >
          <div className="flex items-start gap-2">
            <FileText size={13} style={{ color: activeSlug === plan.slug ? 'var(--accent)' : 'var(--text-tertiary)', flexShrink: 0, marginTop: 1 }} />
            <div className="min-w-0">
              <div className="text-xs font-medium truncate"
                style={{ color: activeSlug === plan.slug ? 'var(--accent)' : 'var(--text-primary)' }}>
                {plan.title.length > 40 ? truncate(plan.title, 40) : plan.title}
              </div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                {relativeTime(plan.modifiedAt * 1000)}
              </div>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}
