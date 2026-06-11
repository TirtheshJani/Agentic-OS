import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { fetchRagStatus, searchRag } from '../../api/memoryRag';
import { cn } from '../../lib/utils';
import { queryKeys } from '../../lib/queryKeys';

type RagMode = 'hybrid' | 'local' | 'global' | 'mix' | 'naive';

const MODES: { value: RagMode; label: string }[] = [
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'mix', label: 'Mix' },
  { value: 'local', label: 'Local' },
  { value: 'global', label: 'Global' },
  { value: 'naive', label: 'Naive' },
];

function StatusBadge({ status }: { status: string }) {
  const isReady = status === 'ready';
  const isInitializing = status === 'initializing';
  return (
    <span
      className="chip text-xs"
      style={{
        background: isReady
          ? 'rgba(34,197,94,0.1)'
          : isInitializing
            ? 'rgba(251,191,36,0.1)'
            : 'rgba(248,81,73,0.1)',
        color: isReady ? '#4ade80' : isInitializing ? '#fbbf24' : '#f85149',
      }}
    >
      {status}
    </span>
  );
}

interface Props {
  className?: string;
}

export function RagSearchPanel({ className }: Props) {
  const [mode, setMode] = useState<RagMode>('hybrid');
  const [topK, setTopK] = useState(10);
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<number | null>(null);

  const { data: ragStatus } = useQuery({
    queryKey: queryKeys.ragStatus(),
    queryFn: fetchRagStatus,
    staleTime: 30_000,
  });

  const { mutate: search, isPending, data: result, isError } = useMutation({
    mutationFn: () => searchRag(query, mode, topK),
  });

  const resultText = result?.answer ?? result?.result ?? '';
  const resultLines = resultText.split('\n').filter(Boolean);

  return (
    <div className={cn('card px-4 py-4 space-y-4', className)}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
          RAG Knowledge Search
        </span>
        {ragStatus && (
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge status={ragStatus.status} />
            {ragStatus.llm_model && (
              <span className="chip text-xs" style={{ color: 'var(--text-tertiary)' }}>
                {ragStatus.llm_model}
              </span>
            )}
            <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
              {ragStatus.budget.inserts ?? 0}/{ragStatus.budget.cap ?? 200} inserts today
            </span>
            {ragStatus.error && (
              <span className="text-xs" style={{ color: 'var(--error)' }}>
                {ragStatus.error}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="flex gap-1 p-0.5 rounded-md w-fit" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)' }}>
        {MODES.map((m) => (
          <button
            key={m.value}
            onClick={() => setMode(m.value)}
            className={cn('px-3 py-1 text-xs rounded transition-all')}
            style={{
              background: mode === m.value ? 'rgba(255,255,255,0.08)' : undefined,
              color: mode === m.value ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontWeight: mode === m.value ? 500 : undefined,
            }}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Top-K: {topK}</span>
        <input
          type="range"
          min={5}
          max={20}
          value={topK}
          onChange={(e) => setTopK(Number(e.target.value))}
          className="flex-1"
          style={{ accentColor: 'var(--accent)' }}
        />
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && query.trim()) search(); }}
          placeholder="Search your knowledge base…"
          className="flex-1 px-3 py-2 text-xs rounded-md bg-transparent"
          style={{ border: '1px solid var(--border)', color: 'var(--text-primary)', outline: 'none' }}
        />
        <button
          onClick={() => query.trim() && search()}
          disabled={isPending || !query.trim()}
          className="flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-all disabled:opacity-40"
          style={{ background: 'var(--accent)', color: '#fff' }}
        >
          <Search size={12} />
          {isPending ? 'Searching…' : 'Search'}
        </button>
      </div>

      {isError && (
        <p className="text-xs" style={{ color: 'var(--error)' }}>Search failed. Check RAG status.</p>
      )}

      {result && resultLines.length > 0 && (
        <div className="space-y-2">
          {resultLines.map((line, i) => {
            const isLong = line.length > 500;
            const isExpanded = expanded === i;
            return (
              <div
                key={i}
                className="rounded-md px-3 py-2.5 text-xs leading-relaxed"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
              >
                <span>
                  {isLong && !isExpanded ? `${line.slice(0, 500)}…` : line}
                </span>
                {isLong && (
                  <button
                    onClick={() => setExpanded(isExpanded ? null : i)}
                    className="ml-2 text-xs"
                    style={{ color: 'var(--accent)' }}
                  >
                    {isExpanded ? 'Show less' : 'Show more'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {result && resultLines.length === 0 && (
        <p className="text-xs text-center py-4" style={{ color: 'var(--text-tertiary)' }}>
          No results found.
        </p>
      )}
    </div>
  );
}
