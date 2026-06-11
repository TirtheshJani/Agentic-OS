import { useState } from 'react';
import { X } from 'lucide-react';
import type { ManagedAgent } from '../../types';
import { cn } from '../../lib/utils';

const MODELS = [
  'claude-opus-4-6',
  'claude-sonnet-4-6',
  'claude-haiku-4-5-20251001',
];

interface Props {
  initial?: Partial<ManagedAgent>;
  onSubmit: (data: Partial<ManagedAgent>) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function AgentForm({ initial, onSubmit, onCancel, isLoading }: Props) {
  const [name, setName] = useState(initial?.name ?? '');
  const [model, setModel] = useState(initial?.model ?? MODELS[0]);
  const [system, setSystem] = useState(initial?.system ?? '');
  const [toolsText, setToolsText] = useState(
    initial?.tools ? JSON.stringify(initial.tools, null, 2) : '[]'
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let tools = [];
    try {
      tools = JSON.parse(toolsText);
    } catch { /* keep empty */ }
    onSubmit({ name, model, system, tools });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.6)' }}
    >
      <form
        onSubmit={handleSubmit}
        className="card w-full max-w-lg p-6 space-y-4"
        style={{ maxHeight: '80vh', overflowY: 'auto' }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            {initial?.id ? 'Edit Agent' : 'Create Agent'}
          </h2>
          <button type="button" onClick={onCancel} className="p-1 rounded hover:bg-white/10">
            <X size={14} style={{ color: 'var(--text-secondary)' }} />
          </button>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 rounded-md text-sm font-mono"
            style={{
              background: 'rgba(0,0,0,0.3)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
            }}
            placeholder="My Agent"
            required
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>Model</label>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="w-full px-3 py-2 rounded-md text-sm font-mono"
            style={{
              background: 'rgba(0,0,0,0.3)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
            }}
          >
            {MODELS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>System Prompt</label>
          <textarea
            value={system}
            onChange={(e) => setSystem(e.target.value)}
            rows={5}
            className="w-full px-3 py-2 rounded-md text-sm font-mono resize-y"
            style={{
              background: 'rgba(0,0,0,0.3)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
            }}
            placeholder="You are a helpful assistant..."
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>Tools (JSON)</label>
          <textarea
            value={toolsText}
            onChange={(e) => setToolsText(e.target.value)}
            rows={4}
            className="w-full px-3 py-2 rounded-md text-sm font-mono resize-y"
            style={{
              background: 'rgba(0,0,0,0.3)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
            }}
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 rounded-md text-xs font-medium hover:bg-white/10"
            style={{ color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isLoading || !name}
            className={cn(
              'px-3 py-1.5 rounded-md text-xs font-medium transition-all',
              isLoading && 'opacity-60 pointer-events-none'
            )}
            style={{ background: 'var(--accent)', color: 'white' }}
          >
            {initial?.id ? 'Update' : 'Create'}
          </button>
        </div>
      </form>
    </div>
  );
}
