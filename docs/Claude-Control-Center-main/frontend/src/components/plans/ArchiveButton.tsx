import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Archive } from 'lucide-react';
import { apiFetch } from '../../api/client';
import { queryKeys } from '../../lib/queryKeys';

interface Props {
  slug: string;
  onArchived?: () => void;
}

export function ArchiveButton({ slug, onArchived }: Props) {
  const [done, setDone] = useState(false);
  const queryClient = useQueryClient();

  const { mutate, isPending } = useMutation({
    mutationFn: () =>
      apiFetch(`/api/plans/${encodeURIComponent(slug)}/archive`, { method: 'POST' }),
    onSuccess: () => {
      setDone(true);
      queryClient.invalidateQueries({ queryKey: queryKeys.plans() });
      queryClient.invalidateQueries({ queryKey: queryKeys.plan(slug) });
      onArchived?.();
    },
  });

  return (
    <button
      onClick={() => !done && mutate()}
      disabled={isPending || done}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs hover:bg-white/10 transition-all disabled:opacity-50"
      style={{ color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
    >
      <Archive size={12} />
      {done ? 'Archived!' : isPending ? 'Archiving…' : 'Archive'}
    </button>
  );
}
