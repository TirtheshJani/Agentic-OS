import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Play, Loader2, Plus, Edit2, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import {
  fetchGwsRecipes, runGwsRecipe, createGwsRecipe, updateGwsRecipe, deleteGwsRecipe,
  type GwsRecipe,
} from '../../api/gws';
import { queryKeys } from '../../lib/queryKeys';
import { StreamDrawer } from './StreamDrawer';
import { RecipeInputModal } from './RecipeInputModal';
import { RecipeForm, type RecipeFormData } from './RecipeForm';

export function RecipesTab() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<GwsRecipe | null>(null);
  const [runStream, setRunStream] = useState<{ args: string[]; source: string } | null>(null);
  const [runResult, setRunResult] = useState<{ id: string; text: string } | null>(null);
  const [inputModal, setInputModal] = useState<GwsRecipe | null>(null);

  const { data: recipes } = useQuery({
    queryKey: queryKeys.gwsRecipes(),
    queryFn: fetchGwsRecipes,
    staleTime: 30_000,
  });

  const createMutation = useMutation({
    mutationFn: (data: RecipeFormData) =>
      createGwsRecipe({
        id: data.id,
        name: data.name,
        description: data.description,
        args: data.args.trim().split(/\s+/).filter(Boolean),
        streaming: data.streaming,
        enabled: true,
        requires_input: data.requires_input,
      }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: queryKeys.gwsRecipes() }); setShowForm(false); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<GwsRecipe> }) => updateGwsRecipe(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: queryKeys.gwsRecipes() }); setEditTarget(null); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteGwsRecipe(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.gwsRecipes() }),
  });

  const runMutation = useMutation({
    mutationFn: ({ id, inputs }: { id: string; inputs?: Record<string, string> }) => runGwsRecipe(id, inputs),
    onSuccess: (data, vars) => {
      if (data.streaming && data.stream_url) {
        const params = new URLSearchParams(data.stream_url.split('?')[1] ?? '');
        setRunStream({ args: params.getAll('args'), source: 'recipe' });
      } else {
        setRunResult({ id: vars.id, text: data.stdout || data.stderr || 'Done' });
      }
      qc.invalidateQueries({ queryKey: queryKeys.gwsAudit() });
    },
  });

  const handleRun = (recipe: GwsRecipe) => {
    if (recipe.requires_input?.length) {
      setInputModal(recipe);
    } else {
      runMutation.mutate({ id: recipe.id });
    }
  };

  const handleSaveEdit = (form: RecipeFormData) => {
    if (!editTarget) return;
    updateMutation.mutate({
      id: editTarget.id,
      data: {
        name: form.name,
        description: form.description,
        args: form.args.trim().split(/\s+/).filter(Boolean),
        streaming: form.streaming,
        requires_input: form.requires_input,
      },
    });
  };

  const builtins = (recipes ?? []).filter((r) => r.builtin);
  const custom = (recipes ?? []).filter((r) => !r.builtin);

  return (
    <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
      {/* Create form */}
      {showForm && !editTarget && (
        <RecipeForm
          onSave={(data) => createMutation.mutate(data)}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* Edit form */}
      {editTarget && (
        <RecipeForm
          initial={{
            id: editTarget.id,
            name: editTarget.name,
            description: editTarget.description ?? '',
            args: editTarget.args.join(' '),
            streaming: editTarget.streaming,
            requires_input: editTarget.requires_input ?? [],
          }}
          isEdit
          onSave={handleSaveEdit}
          onCancel={() => setEditTarget(null)}
        />
      )}

      {/* Built-ins */}
      <div>
        <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-tertiary)' }}>
          Built-in workflows
        </div>
        <div className="space-y-2">
          {builtins.map((recipe) => (
            <div
              key={recipe.id}
              className="card px-4 py-3 flex items-center gap-3"
              style={{ opacity: recipe.enabled ? 1 : 0.5 }}
            >
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{recipe.name}</div>
                {recipe.description && (
                  <div className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-tertiary)' }}>{recipe.description}</div>
                )}
                <div className="text-xs font-mono mt-0.5" style={{ color: 'var(--accent)', opacity: 0.7 }}>
                  gws {recipe.args.join(' ')}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {runResult?.id === recipe.id && (
                  <span className="text-xs font-mono truncate max-w-32" style={{ color: 'var(--text-tertiary)' }}>
                    {runResult.text.slice(0, 60)}
                  </span>
                )}
                <button
                  title={recipe.enabled ? 'Disable' : 'Enable'}
                  onClick={() => updateMutation.mutate({ id: recipe.id, data: { enabled: !recipe.enabled } })}
                  style={{ color: recipe.enabled ? 'var(--accent)' : 'var(--text-tertiary)' }}
                >
                  {recipe.enabled ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                </button>
                <button
                  className="btn-primary text-xs px-2.5 py-1 flex items-center gap-1 disabled:opacity-50"
                  onClick={() => handleRun(recipe)}
                  disabled={!recipe.enabled || runMutation.isPending}
                >
                  {runMutation.isPending ? <Loader2 size={10} className="animate-spin" /> : <Play size={10} />}
                  Run
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Custom */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
            Custom recipes
          </div>
          {!showForm && !editTarget && (
            <button
              className="btn-ghost text-xs px-2.5 py-1 flex items-center gap-1"
              onClick={() => setShowForm(true)}
            >
              <Plus size={11} /> New recipe
            </button>
          )}
        </div>
        {custom.length === 0 && !showForm && (
          <div className="text-xs py-4 text-center" style={{ color: 'var(--text-tertiary)' }}>
            No custom recipes yet — click "New recipe" to create one.
          </div>
        )}
        <div className="space-y-2">
          {custom.map((recipe) => (
            <div key={recipe.id} className="card px-4 py-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{recipe.name}</div>
                {recipe.description && (
                  <div className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-tertiary)' }}>{recipe.description}</div>
                )}
                <div className="text-xs font-mono mt-0.5" style={{ color: 'var(--accent)', opacity: 0.7 }}>
                  gws {recipe.args.join(' ')}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {runResult?.id === recipe.id && (
                  <span className="text-xs font-mono truncate max-w-32" style={{ color: 'var(--text-tertiary)' }}>
                    {runResult.text.slice(0, 60)}
                  </span>
                )}
                <button
                  title="Edit"
                  onClick={() => { setEditTarget(recipe); setShowForm(false); }}
                  style={{ color: 'var(--text-tertiary)' }}
                  className="btn-ghost p-1"
                >
                  <Edit2 size={13} />
                </button>
                <button
                  title="Delete"
                  onClick={() => { if (confirm(`Delete "${recipe.name}"?`)) deleteMutation.mutate(recipe.id); }}
                  style={{ color: '#f87171' }}
                  className="btn-ghost p-1"
                >
                  <Trash2 size={13} />
                </button>
                <button
                  className="btn-primary text-xs px-2.5 py-1 flex items-center gap-1 disabled:opacity-50"
                  onClick={() => handleRun(recipe)}
                  disabled={runMutation.isPending}
                >
                  {runMutation.isPending ? <Loader2 size={10} className="animate-spin" /> : <Play size={10} />}
                  Run
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {runStream && (
        <StreamDrawer args={runStream.args} source={runStream.source} onClose={() => setRunStream(null)} />
      )}

      {inputModal && (
        <RecipeInputModal
          recipe={inputModal}
          onSubmit={(inputs) => {
            setInputModal(null);
            runMutation.mutate({ id: inputModal.id, inputs });
          }}
          onClose={() => setInputModal(null)}
        />
      )}
    </div>
  );
}
