import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryKeys';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Plus, Trash2, X, RefreshCw } from 'lucide-react';
import { fetchVaults, addVault, removeVault } from '../api/obsidian';
import { relativeTime } from '../lib/utils';

export function ObsidianPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [vaultName, setVaultName] = useState('');
  const [vaultPath, setVaultPath] = useState('');
  const [formErr, setFormErr] = useState('');

  const { data: vaults = [], isLoading } = useQuery({
    queryKey: queryKeys.obsidianVaults(),
    queryFn: fetchVaults,
    staleTime: 30_000,
  });

  const { mutate: createVault, isPending: creating } = useMutation({
    mutationFn: () => addVault(vaultName.trim(), vaultPath.trim()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.obsidianVaults() });
      setShowAddForm(false);
      setVaultName('');
      setVaultPath('');
      setFormErr('');
    },
    onError: (e: Error) => setFormErr(e.message),
  });

  const { mutate: deleteVault } = useMutation({
    mutationFn: (vaultId: string) => removeVault(vaultId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.obsidianVaults() }),
  });

  function handleAdd() {
    setFormErr('');
    if (!vaultName.trim()) { setFormErr('Vault name is required'); return; }
    if (!vaultPath.trim()) { setFormErr('Vault path is required'); return; }
    createVault();
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <BookOpen size={18} style={{ color: 'var(--accent)' }} />
          <h1 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Obsidian Vaults</h1>
        </div>
        <button
          onClick={() => setShowAddForm((v) => !v)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all"
          style={{ background: showAddForm ? 'rgba(255,255,255,0.06)' : 'var(--accent)', color: showAddForm ? 'var(--text-secondary)' : '#fff', border: showAddForm ? '1px solid var(--border)' : undefined }}
        >
          {showAddForm ? <X size={12} /> : <Plus size={12} />}
          {showAddForm ? 'Cancel' : 'Add Vault'}
        </button>
      </div>

      {showAddForm && (
        <div className="card px-5 py-4 mb-5 space-y-3" style={{ border: '1px solid var(--border)' }}>
          <div className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>New Vault</div>
          <label className="block">
            <span className="text-xs mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Vault name</span>
            <input
              type="text"
              value={vaultName}
              onChange={(e) => setVaultName(e.target.value)}
              placeholder="My Notes"
              className="w-full px-3 py-2 text-xs rounded-md bg-transparent"
              style={{ border: '1px solid var(--border)', color: 'var(--text-primary)', outline: 'none' }}
            />
          </label>
          <label className="block">
            <span className="text-xs mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>Vault path (local filesystem)</span>
            <input
              type="text"
              value={vaultPath}
              onChange={(e) => setVaultPath(e.target.value)}
              placeholder="/home/user/Documents/MyNotes"
              className="w-full px-3 py-2 text-xs rounded-md bg-transparent font-mono"
              style={{ border: '1px solid var(--border)', color: 'var(--text-primary)', outline: 'none' }}
            />
          </label>
          {formErr && <p className="text-xs" style={{ color: 'var(--error)' }}>{formErr}</p>}
          <button
            onClick={handleAdd}
            disabled={creating}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium disabled:opacity-40"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            {creating ? 'Adding…' : 'Add Vault'}
          </button>
        </div>
      )}

      {isLoading && (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card p-4"><div className="skeleton h-5 w-36" /></div>
          ))}
        </div>
      )}

      {!isLoading && vaults.length === 0 && (
        <div className="card p-12 text-center">
          <BookOpen size={32} className="mx-auto mb-3" style={{ color: 'var(--text-tertiary)' }} />
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            No vaults configured. Add a vault to start syncing notes into RAG memory.
          </p>
        </div>
      )}

      {!isLoading && vaults.length > 0 && (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
          {vaults.map((vault) => (
            <div key={vault.id} className="card px-4 py-4 flex flex-col gap-3" style={{ border: '1px solid var(--border)' }}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium mb-0.5" style={{ color: 'var(--text-primary)' }}>{vault.name}</div>
                  <div className="text-xs font-mono truncate" style={{ color: 'var(--text-tertiary)' }} title={vault.path}>{vault.path}</div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteVault(vault.id); }}
                  className="p-1 rounded hover:bg-white/10 transition-all flex-shrink-0"
                >
                  <Trash2 size={13} style={{ color: 'var(--text-tertiary)' }} />
                </button>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className="chip text-xs"
                  style={{
                    background: vault.enabled ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.05)',
                    color: vault.enabled ? '#4ade80' : 'var(--text-tertiary)',
                  }}
                >
                  {vault.enabled ? 'Enabled' : 'Disabled'}
                </span>
                {vault.last_synced && (
                  <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    Synced {relativeTime(vault.last_synced)}
                  </span>
                )}
              </div>

              <button
                onClick={() => navigate(`/obsidian/${vault.id}`)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all hover:bg-white/10 w-fit"
                style={{ color: 'var(--accent)', border: '1px solid var(--accent)' }}
              >
                <RefreshCw size={11} /> Open
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
