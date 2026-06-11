import { useState } from 'react';
import type { GwsRecipe } from '../../api/gws';

export function RecipeInputModal({ recipe, onSubmit, onClose }: {
  recipe: GwsRecipe;
  onSubmit: (inputs: Record<string, string>) => void;
  onClose: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>({});

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={onClose}
    >
      <div
        className="rounded-lg p-6 w-full max-w-sm"
        style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>{recipe.name}</div>
        {(recipe.requires_input ?? []).map((field) => (
          <div key={field.key} className="mb-3">
            <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>{field.label}</label>
            <input
              className="w-full rounded px-2 py-1.5 text-sm"
              style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
              value={values[field.key] ?? ''}
              onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
              placeholder={`Enter ${field.label.toLowerCase()}`}
            />
          </div>
        ))}
        <div className="flex gap-2 justify-end mt-4">
          <button className="btn-ghost text-xs px-3 py-1.5" onClick={onClose}>Cancel</button>
          <button className="btn-primary text-xs px-3 py-1.5" onClick={() => onSubmit(values)}>Run</button>
        </div>
      </div>
    </div>
  );
}
