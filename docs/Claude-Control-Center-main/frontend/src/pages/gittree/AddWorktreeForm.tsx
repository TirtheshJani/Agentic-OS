import { useState } from 'react';
import { RefreshCw, X, Plus, AlertCircle } from 'lucide-react';
import { useCreateWorktree } from '../../hooks/useGitTree';

interface AddWorktreeFormProps {
  repoId: string;
  onClose: () => void;
}

export function AddWorktreeForm({ repoId, onClose }: AddWorktreeFormProps) {
  const [dest, setDest] = useState('');
  const [branch, setBranch] = useState('');
  const [newBranch, setNewBranch] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const create = useCreateWorktree(repoId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!dest.trim() || !branch.trim()) {
      setError('Destination path and branch name are required.');
      return;
    }
    try {
      await create.mutateAsync({ dest: dest.trim(), branch: branch.trim(), newBranch });
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    }
  }

  return (
    <div
      className="card"
      style={{ padding: '20px 20px 16px', marginBottom: 16, border: '1px solid var(--accent)', borderRadius: 3 }}
    >
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
          Add Worktree
        </span>
        <button onClick={onClose} style={{ color: 'var(--text-tertiary)' }}>
          <X size={14} />
        </button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>
            Destination path (absolute)
          </label>
          <input
            className="input-field"
            value={dest}
            onChange={(e) => setDest(e.target.value)}
            placeholder="/home/user/worktrees/feature-x"
          />
        </div>
        <div>
          <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>
            Branch name
          </label>
          <input
            className="input-field"
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            placeholder="feature/my-branch"
          />
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="new-branch"
            checked={newBranch}
            onChange={(e) => setNewBranch(e.target.checked)}
          />
          <label htmlFor="new-branch" className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Create new branch (<code>-b</code>)
          </label>
        </div>
        {error && (
          <div className="flex items-start gap-2 text-xs" style={{ color: '#f87171' }}>
            <AlertCircle size={12} style={{ flexShrink: 0, marginTop: 1 }} />
            {error}
          </div>
        )}
        <div className="flex items-center gap-2 justify-end pt-1">
          <button type="button" className="btn-secondary" style={{ padding: '6px 14px' }} onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            className="btn-primary"
            style={{ padding: '6px 14px' }}
            disabled={create.isPending}
          >
            {create.isPending ? <RefreshCw size={12} className="animate-spin" /> : <Plus size={12} />}
            Create
          </button>
        </div>
      </form>
    </div>
  );
}
