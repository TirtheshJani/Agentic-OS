import { useState } from 'react';
import { GitBranch } from 'lucide-react';
import { useGitRepos } from '../hooks/useGitTree';
import { RepoSelector } from './gittree/RepoSelector';
import { WorktreesTab } from './gittree/WorktreesTab';
import { GitGraphTab } from './gittree/GitGraphTab';

type Tab = 'worktrees' | 'graph';

export function GitTreePage() {
  const [activeTab, setActiveTab] = useState<Tab>('worktrees');
  const [selectedRepo, setSelectedRepo] = useState<string | null>(null);
  const { data: repos = [], isLoading: reposLoading } = useGitRepos();

  const tabs: { id: Tab; label: string }[] = [
    { id: 'worktrees', label: 'Worktrees' },
    { id: 'graph', label: 'Git Graph' },
  ];

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <GitBranch size={18} style={{ color: 'var(--accent)' }} />
        <h1 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
          Git Tree
        </h1>
        <span className="chip text-xs" style={{ background: 'rgba(14,207,192,0.1)', color: 'var(--accent)' }}>
          beta
        </span>
      </div>

      {/* Repo selector + tabs row */}
      <div className="flex items-center gap-4 mb-6 flex-wrap">
        {reposLoading ? (
          <div className="skeleton" style={{ width: 200, height: 34, borderRadius: 2 }} />
        ) : (
          <RepoSelector repos={repos} selected={selectedRepo} onChange={setSelectedRepo} />
        )}

        <div className="flex items-center gap-1 border-b" style={{ borderColor: 'var(--border)', marginLeft: 'auto' }}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="px-4 py-2 text-sm transition-colors"
              style={{
                color: activeTab === tab.id ? 'var(--accent)' : 'var(--text-secondary)',
                borderBottom: activeTab === tab.id ? '2px solid var(--accent)' : '2px solid transparent',
                marginBottom: -1,
                background: 'transparent',
                cursor: 'pointer',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      {activeTab === 'worktrees' && <WorktreesTab repoId={selectedRepo} />}
      {activeTab === 'graph' && <GitGraphTab repoId={selectedRepo} />}
    </div>
  );
}
