import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useQuery } from '@tanstack/react-query';
import { fetchPlan } from '../../api/plans';
import { absoluteTime } from '../../lib/utils';
import { queryKeys } from '../../lib/queryKeys';
import { FileText } from 'lucide-react';
import { PlanSteps } from './PlanSteps';
import { ArchiveButton } from './ArchiveButton';
import { PinSessionButton } from './PinSessionButton';

interface Props {
  slug: string;
}

export function PlanViewer({ slug }: Props) {
  const [pinSessionId, setPinSessionId] = useState('');
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.plan(slug),
    queryFn: () => fetchPlan(slug),
    staleTime: 60_000,
    enabled: !!slug,
  });

  if (isLoading) {
    return (
      <div className="p-8 space-y-4 max-w-3xl">
        <div className="skeleton h-8 w-2/3" />
        <div className="skeleton h-4 w-full" />
        <div className="skeleton h-4 w-4/5" />
        <div className="skeleton h-4 w-full" />
        <div className="skeleton h-4 w-3/4" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm" style={{ color: 'var(--error)' }}>Failed to load plan</p>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <FileText size={14} style={{ color: 'var(--text-tertiary)' }} />
        <span className="text-xs font-mono" style={{ color: 'var(--text-tertiary)' }}>{data.slug}</span>
        <span className="text-xs ml-auto" style={{ color: 'var(--text-tertiary)' }}>
          Modified {absoluteTime(data.modifiedAt * 1000)}
        </span>
      </div>
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        <ArchiveButton slug={slug} />
        <input
          type="text"
          value={pinSessionId}
          onChange={(e) => setPinSessionId(e.target.value)}
          placeholder="Session ID to track…"
          className="px-2 py-1.5 rounded-md text-xs bg-transparent w-44"
          style={{ border: '1px solid var(--border)', color: 'var(--text-primary)', outline: 'none' }}
        />
        {pinSessionId.trim() && (
          <PinSessionButton slug={slug} sessionId={pinSessionId.trim()} onPinned={() => setPinSessionId('')} />
        )}
      </div>
      <PlanSteps slug={slug} />
      <div className="prose-dark animate-fade-in">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{data.raw}</ReactMarkdown>
      </div>
    </div>
  );
}
