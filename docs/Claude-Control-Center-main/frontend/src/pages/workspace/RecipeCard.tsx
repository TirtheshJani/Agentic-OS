import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Play, Loader2 } from 'lucide-react';
import { runGwsRecipe, type GwsRecipe } from '../../api/gws';
import { queryKeys } from '../../lib/queryKeys';
import { StreamDrawer } from './StreamDrawer';
import { RecipeInputModal } from './RecipeInputModal';

export function RecipeCard({ recipe }: { recipe: GwsRecipe }) {
  const qc = useQueryClient();
  const [streamArgs, setStreamArgs] = useState<string[] | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [inputModal, setInputModal] = useState(false);

  const runMutation = useMutation({
    mutationFn: (inputs?: Record<string, string>) => runGwsRecipe(recipe.id, inputs),
    onSuccess: (data) => {
      if (data.streaming && data.stream_url) {
        const params = new URLSearchParams(data.stream_url.split('?')[1] ?? '');
        setStreamArgs(params.getAll('args'));
      } else {
        setResult(data.stdout || data.stderr || 'Done');
      }
      qc.invalidateQueries({ queryKey: queryKeys.gwsAudit() });
    },
  });

  const handleRun = () => {
    if (recipe.requires_input?.length) {
      setInputModal(true);
    } else {
      runMutation.mutate(undefined);
    }
  };

  return (
    <>
      <div className="card flex-shrink-0 flex flex-col gap-2 p-4" style={{ width: 200, minWidth: 180 }}>
        <div className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{recipe.name}</div>
        {recipe.description && (
          <div className="text-xs leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>{recipe.description}</div>
        )}
        <div className="mt-auto pt-2">
          <button
            className="btn-primary text-xs px-3 py-1.5 w-full flex items-center justify-center gap-1.5 disabled:opacity-50"
            onClick={handleRun}
            disabled={!recipe.enabled || runMutation.isPending}
          >
            {runMutation.isPending ? <Loader2 size={11} className="animate-spin" /> : <Play size={11} />}
            Run
          </button>
        </div>
        {result && (
          <div
            className="text-xs font-mono mt-1 p-2 rounded overflow-hidden"
            style={{ background: 'var(--bg-code)', color: 'var(--text-secondary)', maxHeight: 80, overflowY: 'auto' }}
          >
            {result.slice(0, 400)}
          </div>
        )}
      </div>

      {streamArgs && (
        <StreamDrawer args={streamArgs} source="recipe" onClose={() => setStreamArgs(null)} />
      )}

      {inputModal && (
        <RecipeInputModal
          recipe={recipe}
          onSubmit={(inputs) => { setInputModal(false); runMutation.mutate(inputs); }}
          onClose={() => setInputModal(false)}
        />
      )}
    </>
  );
}
