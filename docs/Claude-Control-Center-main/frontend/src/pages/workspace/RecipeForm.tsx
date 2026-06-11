import { useState } from 'react';
import { X, Plus, ToggleLeft, ToggleRight } from 'lucide-react';

export interface RecipeFormData {
  id: string;
  name: string;
  description: string;
  args: string;
  streaming: boolean;
  requires_input: { key: string; label: string; flag: string }[];
}

const EMPTY_FORM: RecipeFormData = {
  id: '', name: '', description: '', args: '', streaming: false, requires_input: [],
};

export function RecipeForm({
  initial,
  onSave,
  onCancel,
  isEdit,
}: {
  initial?: RecipeFormData;
  onSave: (data: RecipeFormData) => void;
  onCancel: () => void;
  isEdit?: boolean;
}) {
  const [form, setForm] = useState<RecipeFormData>(initial ?? EMPTY_FORM);

  const set = (k: keyof RecipeFormData, v: RecipeFormData[keyof RecipeFormData]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const addInput = () =>
    setForm((f) => ({ ...f, requires_input: [...f.requires_input, { key: '', label: '', flag: '' }] }));

  const updateInput = (i: number, k: 'key' | 'label' | 'flag', v: string) =>
    setForm((f) => {
      const ri = [...f.requires_input];
      ri[i] = { ...ri[i], [k]: v };
      return { ...f, requires_input: ri };
    });

  const removeInput = (i: number) =>
    setForm((f) => ({ ...f, requires_input: f.requires_input.filter((_, j) => j !== i) }));

  const inputStyle = {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    color: 'var(--text-primary)',
    borderRadius: 4,
    padding: '4px 8px',
    fontSize: 12,
    width: '100%',
  };

  return (
    <div className="card p-5 space-y-3">
      <div className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
        {isEdit ? 'Edit Recipe' : 'New Recipe'}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>ID (slug)</label>
          <input style={inputStyle} value={form.id} onChange={(e) => set('id', e.target.value)} placeholder="my-recipe" disabled={isEdit} />
        </div>
        <div>
          <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Name</label>
          <input style={inputStyle} value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="My Recipe" />
        </div>
      </div>

      <div>
        <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Description</label>
        <input style={inputStyle} value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="What does this recipe do?" />
      </div>

      <div>
        <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>
          Args <span style={{ color: 'var(--text-tertiary)' }}>(space-separated, e.g. workflow +weekly-digest)</span>
        </label>
        <input style={inputStyle} value={form.args} onChange={(e) => set('args', e.target.value)} placeholder="gmail +triage" />
      </div>

      <label className="flex items-center gap-2 cursor-pointer select-none">
        <button
          type="button"
          onClick={() => set('streaming', !form.streaming)}
          style={{ color: form.streaming ? 'var(--accent)' : 'var(--text-tertiary)' }}
        >
          {form.streaming ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
        </button>
        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Streaming output</span>
      </label>

      {form.requires_input.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Input fields</div>
          {form.requires_input.map((inp, i) => (
            <div key={i} className="flex gap-2 items-center">
              <input style={{ ...inputStyle, width: 'auto', flex: 1 }} value={inp.key} onChange={(e) => updateInput(i, 'key', e.target.value)} placeholder="key" />
              <input style={{ ...inputStyle, width: 'auto', flex: 1 }} value={inp.label} onChange={(e) => updateInput(i, 'label', e.target.value)} placeholder="Label" />
              <input style={{ ...inputStyle, width: 'auto', flex: 1 }} value={inp.flag} onChange={(e) => updateInput(i, 'flag', e.target.value)} placeholder="--flag" />
              <button onClick={() => removeInput(i)} style={{ color: '#f87171' }}><X size={13} /></button>
            </div>
          ))}
        </div>
      )}
      <button className="btn-ghost text-xs px-2 py-1 flex items-center gap-1" onClick={addInput}>
        <Plus size={11} /> Add input field
      </button>

      <div className="flex gap-2 justify-end pt-2" style={{ borderTop: '1px solid var(--border)' }}>
        <button className="btn-ghost text-xs px-3 py-1.5" onClick={onCancel}>Cancel</button>
        <button className="btn-primary text-xs px-3 py-1.5" onClick={() => onSave(form)}>
          {isEdit ? 'Save' : 'Create'}
        </button>
      </div>
    </div>
  );
}
