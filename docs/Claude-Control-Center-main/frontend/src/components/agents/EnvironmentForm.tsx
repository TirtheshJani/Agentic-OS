import { useState } from 'react';
import { X, Plus, Minus } from 'lucide-react';
import type { AgentEnvironment } from '../../types';
import { cn } from '../../lib/utils';

interface Props {
  initial?: Partial<AgentEnvironment>;
  onSubmit: (data: Partial<AgentEnvironment>) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function EnvironmentForm({ initial, onSubmit, onCancel, isLoading }: Props) {
  const [name, setName] = useState(initial?.name ?? '');
  const [packages, setPackages] = useState<string[]>(initial?.packages ?? []);
  const [networkAccess, setNetworkAccess] = useState(initial?.network_access ?? false);
  const [newPkg, setNewPkg] = useState('');

  const addPackage = () => {
    if (newPkg.trim()) {
      setPackages((prev) => [...prev, newPkg.trim()]);
      setNewPkg('');
    }
  };

  const removePackage = (idx: number) => {
    setPackages((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ name, packages, network_access: networkAccess });
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
            {initial?.id ? 'Edit Environment' : 'Create Environment'}
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
            placeholder="Python Data Science"
            required
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>Packages</label>
          <div className="space-y-1">
            {packages.map((pkg, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-xs font-mono flex-1" style={{ color: 'var(--text-secondary)' }}>{pkg}</span>
                <button type="button" onClick={() => removePackage(i)} className="p-1 rounded hover:bg-white/10">
                  <Minus size={11} style={{ color: '#f85149' }} />
                </button>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              value={newPkg}
              onChange={(e) => setNewPkg(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addPackage(); } }}
              className="flex-1 px-3 py-1.5 rounded-md text-xs font-mono"
              style={{
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
              }}
              placeholder="numpy, pandas, etc."
            />
            <button
              type="button"
              onClick={addPackage}
              className="p-1.5 rounded hover:bg-white/10"
              style={{ border: '1px solid var(--border)' }}
            >
              <Plus size={12} style={{ color: 'var(--text-secondary)' }} />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={networkAccess}
            onChange={(e) => setNetworkAccess(e.target.checked)}
            id="network-access"
          />
          <label htmlFor="network-access" className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
            Allow network access
          </label>
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
