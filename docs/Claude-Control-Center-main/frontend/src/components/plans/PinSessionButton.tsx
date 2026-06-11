import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Pin } from 'lucide-react';
import { apiFetch } from '../../api/client';
import { queryKeys } from '../../lib/queryKeys';

interface Props {
  slug: string;
  sessionId: string;
  onPinned?: () => void;
}

export function PinSessionButton({ slug, sessionId, onPinned }: Props) {
  const queryClient = useQueryClient();

  const { mutate, isPending, isSuccess } = useMutation({
    mutationFn: () =>
      apiFetch(`/api/plans/${encodeURIComponent(slug)}/pin`, {
        method: 'POST',
        body: JSON.stringify({ session_id: sessionId }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.plan(slug) });
      onPinned?.();
    },
  });

  return (
    <button
      onClick={() => mutate()}
      disabled={isPending || isSuccess}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs hover:bg-white/10 transition-all disabled:opacity-50"
      style={{ color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
    >
      <Pin size={12} />
      {isSuccess ? 'Pinned!' : isPending ? 'Pinning…' : 'Track in session'}
    </button>
  );
}
