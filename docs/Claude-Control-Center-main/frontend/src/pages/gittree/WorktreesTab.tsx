import { useState } from 'react';
import { GitBranch, RefreshCw, Trash2, Lock, Unlock, Plus } from 'lucide-react';
import {
  useWorktrees,
  useRemoveWorktree,
  useLockWorktree,
  useUnlockWorktree,
} from '../../hooks/useGitTree';
import { AddWorktreeForm } from './AddWorktreeForm';

export function WorktreesTab({ repoId }: { repoId: string | null }) {
  const [showForm, setShowForm] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [forceRemove, setForceRemove] = useState(false);
  const [lockReason, setLockReason] = useState('');

  const { data: worktrees = [], isLoading, refetch } = useWorktrees(repoId);
  const remove = useRemoveWorktree(repoId);
  const lock = useLockWorktree(repoId);
  const unlock = useUnlockWorktree(repoId);

  if (!repoId) {
    return (
      <div className="card" style={{ padding: '40px 24px', textAlign: 'center' }}>
        <GitBranch size={28} style={{ color: 'var(--text-tertiary)', margin: '0 auto 12px' }} />
        <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
          Select a repository to manage worktrees.
        </p>
      </div>
    );
  }

  async function handleRemove(path: string) {
    try {
      await remove.mutateAsync({ path, force: forceRemove });
      setConfirmRemove(null);
      setForceRemove(false);
    } catch {
      // error shown via remove.error
    }
  }

  async function handleLockToggle(path: string, isLocked: boolean) {
    if (isLocked) {
      await unlock.mutateAsync({ path });
    } else {
      await lock.mutateAsync({ path, reason: lockReason || undefined });
      setLockReason('');
    }
  }

  return (
    <div>
      {/* Actions bar */}
      <div className="flex items-center gap-3 mb-4">
        <button
          className="btn-primary"
          style={{ padding: '6px 14px', fontSize: 13 }}
          onClick={() => setShowForm(true)}
          disabled={showForm}
        >
          <Plus size={13} />
          Add Worktree
        </button>
        <button
          className="btn-secondary"
          style={{ padding: '6px 10px' }}
          onClick={() => refetch()}
        >
          <RefreshCw size={13} />
        </button>
        {remove.isError && (
          <span className="text-xs" style={{ color: '#f87171' }}>
            {(remove.error as Error)?.message}
          </span>
        )}
      </div>

      {/* Add form */}
      {showForm && (
        <AddWorktreeForm repoId={repoId} onClose={() => setShowForm(false)} />
      )}

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card p-4 space-y-2">
              <div className="skeleton h-4 w-1/3" />
              <div className="skeleton h-3 w-2/3" />
            </div>
          ))}
        </div>
      ) : worktrees.length === 0 ? (
        <div className="card" style={{ padding: '40px 24px', textAlign: 'center' }}>
          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No worktrees found.</p>
        </div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          {/* Header */}
          <div
            className="grid text-xs font-medium px-4 py-2"
            style={{
              gridTemplateColumns: '1fr 130px 90px 110px 110px',
              color: 'var(--text-tertiary)',
              borderBottom: '1px solid var(--border)',
            }}
          >
            <span>Path</span>
            <span>Branch</span>
            <span>HEAD</span>
            <span>Status</span>
            <span style={{ textAlign: 'right' }}>Actions</span>
          </div>

          {worktrees.map((wt) => (
            <div key={wt.path}>
              <div
                className="grid items-center px-4 py-3 text-sm"
                style={{
                  gridTemplateColumns: '1fr 130px 90px 110px 110px',
                  borderBottom: '1px solid var(--border)',
                }}
              >
                {/* Path */}
                <span
                  style={{
                    color: 'var(--text-primary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    fontFamily: 'monospace',
                    fontSize: 12,
                  }}
                  title={wt.path}
                >
                  {wt.path}
                </span>

                {/* Branch */}
                <span
                  className="text-xs"
                  style={{ color: 'var(--accent)', fontFamily: 'monospace' }}
                >
                  {wt.branch ?? <em style={{ color: 'var(--text-tertiary)' }}>detached</em>}
                </span>

                {/* HEAD */}
                <span
                  style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--text-tertiary)' }}
                >
                  {wt.headHash.slice(0, 7)}
                </span>

                {/* Status chips */}
                <div className="flex items-center gap-1 flex-wrap">
                  {wt.isMain && (
                    <span className="chip" style={{ background: 'rgba(14,207,192,0.12)', color: '#0ecfc0', fontSize: 10 }}>
                      main
                    </span>
                  )}
                  {wt.isDetached && (
                    <span className="chip" style={{ background: 'rgba(234,179,8,0.12)', color: '#eab308', fontSize: 10 }}>
                      detached
                    </span>
                  )}
                  {wt.isLocked && (
                    <span className="chip" style={{ background: 'rgba(248,113,113,0.12)', color: '#f87171', fontSize: 10 }}>
                      locked
                    </span>
                  )}
                  {wt.prunable && (
                    <span className="chip" style={{ background: 'rgba(107,114,128,0.1)', color: '#9ca3af', fontSize: 10 }}>
                      prunable
                    </span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 justify-end">
                  {!wt.isMain && (
                    <>
                      <button
                        title={wt.isLocked ? 'Unlock' : 'Lock'}
                        style={{ color: wt.isLocked ? '#f87171' : 'var(--text-tertiary)' }}
                        onClick={() => handleLockToggle(wt.path, wt.isLocked)}
                        disabled={lock.isPending || unlock.isPending}
                      >
                        {wt.isLocked ? <Unlock size={13} /> : <Lock size={13} />}
                      </button>
                      <button
                        title="Remove"
                        style={{ color: 'var(--text-tertiary)' }}
                        onClick={() => {
                          setConfirmRemove(wt.path);
                          setForceRemove(false);
                        }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Inline remove confirmation */}
              {confirmRemove === wt.path && (
                <div
                  className="px-4 py-3"
                  style={{ background: 'rgba(248,113,113,0.06)', borderBottom: '1px solid var(--border)' }}
                >
                  <p className="text-xs mb-2" style={{ color: '#f87171' }}>
                    Remove worktree at <code>{wt.path}</code>?
                  </p>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
                      <input
                        type="checkbox"
                        checked={forceRemove}
                        onChange={(e) => setForceRemove(e.target.checked)}
                      />
                      Force (discard changes)
                    </label>
                    <button
                      className="btn-secondary"
                      style={{ padding: '4px 10px', fontSize: 12 }}
                      onClick={() => { setConfirmRemove(null); setForceRemove(false); }}
                    >
                      Cancel
                    </button>
                    <button
                      style={{
                        padding: '4px 10px',
                        fontSize: 12,
                        background: 'rgba(248,113,113,0.15)',
                        color: '#f87171',
                        border: '1px solid rgba(248,113,113,0.3)',
                        borderRadius: 2,
                        cursor: 'pointer',
                      }}
                      disabled={remove.isPending}
                      onClick={() => handleRemove(wt.path)}
                    >
                      {remove.isPending ? <RefreshCw size={11} className="animate-spin" /> : <Trash2 size={11} />}
                      Remove
                    </button>
                  </div>
                  {remove.isError && (
                    <p className="text-xs mt-2" style={{ color: '#f87171' }}>
                      {(remove.error as Error)?.message}
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
