import { useState } from 'react';
import {
  GitBranch, GitPullRequest, CircleDot, Activity, Settings2,
  Plus, Trash2, X, RefreshCw, ExternalLink, GitCommit,
  AlertCircle, CheckCircle2, Clock, Milestone,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryKeys';
import { cn, relativeTime } from '../lib/utils';
import {
  useGithubStatus,
  useGithubRoots,
  useGithubRepos,
  useGithubBranches,
  useGithubActivity,
  useGithubPRs,
  useGithubIssues,
  useGithubMilestones,
  useAddRoot,
  useRemoveRoot,
  useUpdateRoot,
} from '../hooks/useGithub';
import { triggerRefresh } from '../api/github';
import type { DiscoveredRepo, CommitActivity } from '../types';

type Tab = 'prs' | 'issues' | 'repos' | 'activity' | 'settings';

export function GithubPage() {
  const [activeTab, setActiveTab] = useState<Tab>('repos');
  const { data: status } = useGithubStatus();
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await triggerRefresh();
      setTimeout(() => {
        qc.invalidateQueries({ queryKey: queryKeys.githubStatus() });
        qc.invalidateQueries({ queryKey: queryKeys.githubRepos() });
        qc.invalidateQueries({ queryKey: queryKeys.githubActivity() });
        qc.invalidateQueries({ queryKey: queryKeys.githubPrs() });
        qc.invalidateQueries({ queryKey: queryKeys.githubIssues() });
      }, 2000);
    } finally {
      setTimeout(() => setRefreshing(false), 2500);
    }
  }

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'repos',    label: 'Repos',    icon: <GitBranch size={13} /> },
    { id: 'prs',      label: 'PRs',      icon: <GitPullRequest size={13} /> },
    { id: 'issues',   label: 'Issues',   icon: <CircleDot size={13} /> },
    { id: 'activity', label: 'Activity', icon: <Activity size={13} /> },
    { id: 'settings', label: 'Settings', icon: <Settings2 size={13} /> },
  ];

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <GitBranch size={18} style={{ color: 'var(--accent)' }} />
          <h1 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>GitHub</h1>
          {status?.github_auth && status.github_login && (
            <span className="chip" style={{ fontSize: '11px' }}>{status.github_login}</span>
          )}
          {status && !status.token_configured && (
            <span className="chip" style={{ fontSize: '11px', background: 'rgba(251,191,36,0.12)', color: '#fbbf24' }}>
              No PAT
            </span>
          )}
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium"
          style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
        >
          <RefreshCw size={12} className={cn(refreshing && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '0' }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors"
            style={{
              color: activeTab === t.id ? 'var(--accent)' : 'var(--text-secondary)',
              borderBottom: activeTab === t.id ? '2px solid var(--accent)' : '2px solid transparent',
              marginBottom: '-1px',
              background: 'none',
              border: 'none',
              borderBottomStyle: 'solid',
              borderBottomWidth: '2px',
              borderBottomColor: activeTab === t.id ? 'var(--accent)' : 'transparent',
              cursor: 'pointer',
            }}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'repos'    && <ReposTab />}
      {activeTab === 'prs'      && <PRsTab />}
      {activeTab === 'issues'   && <IssuesTab />}
      {activeTab === 'activity' && <ActivityTab />}
      {activeTab === 'settings' && <SettingsTab />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Repos tab
// ---------------------------------------------------------------------------

function ReposTab() {
  const { data: repos = [], isLoading } = useGithubRepos();
  const [expandedRepo, setExpandedRepo] = useState<string | null>(null);

  if (isLoading) return <LoadingSpinner />;
  if (repos.length === 0) {
    return (
      <EmptyState
        icon={<GitBranch size={28} />}
        title="No repos found"
        description="Add a root path in Settings to discover git repositories."
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {repos.map((repo) => (
        <div key={repo.id}>
          <div
            className="card cursor-pointer"
            style={{ padding: '14px 16px' }}
            onClick={() => setExpandedRepo(expandedRepo === repo.id ? null : repo.id)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <GitBranch size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{repo.name}</span>
                    {repo.current_branch && (
                      <span className="chip" style={{ fontSize: '10px' }}>{repo.current_branch}</span>
                    )}
                    {repo.dirty && (
                      <span className="chip" style={{ fontSize: '10px', background: 'rgba(251,191,36,0.12)', color: '#fbbf24' }}>modified</span>
                    )}
                    {(repo.ahead ?? 0) > 0 && (
                      <span className="chip" style={{ fontSize: '10px', background: 'rgba(34,197,94,0.12)', color: '#4ade80' }}>↑{repo.ahead}</span>
                    )}
                    {(repo.behind ?? 0) > 0 && (
                      <span className="chip" style={{ fontSize: '10px', background: 'rgba(251,113,133,0.12)', color: '#fb7185' }}>↓{repo.behind}</span>
                    )}
                  </div>
                  <div className="text-xs mt-0.5 font-mono" style={{ color: 'var(--text-tertiary)' }}>{repo.path}</div>
                  {repo.remote_owner && repo.remote_repo && (
                    <div className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                      {repo.remote_owner}/{repo.remote_repo}
                    </div>
                  )}
                </div>
              </div>
              <div className="text-xs flex-shrink-0 ml-4" style={{ color: 'var(--text-tertiary)' }}>
                {repo.last_commit_at ? relativeTime(repo.last_commit_at) : '—'}
              </div>
            </div>
          </div>
          {expandedRepo === repo.id && <BranchPanel repoPath={repo.path} />}
        </div>
      ))}
    </div>
  );
}

function BranchPanel({ repoPath }: { repoPath: string }) {
  const { data: branches = [], isLoading } = useGithubBranches(repoPath);
  if (isLoading) return <LoadingSpinner small />;
  const local = branches.filter((b) => !b.is_remote);
  const remote = branches.filter((b) => b.is_remote);
  return (
    <div className="card mt-1" style={{ padding: '12px 16px', background: 'rgba(255,255,255,0.02)' }}>
      <div className="text-xs font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>Branches</div>
      <div className="flex flex-col gap-1">
        {local.map((b) => (
          <div key={b.name} className="flex items-center gap-2 text-xs">
            <GitBranch size={11} style={{ color: b.is_current ? 'var(--accent)' : 'var(--text-tertiary)', flexShrink: 0 }} />
            <span style={{ color: b.is_current ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: b.is_current ? 600 : 400 }}>
              {b.name}
            </span>
            {b.upstream && <span className="font-mono" style={{ color: 'var(--text-tertiary)', fontSize: '10px' }}>→ {b.upstream}</span>}
            <span className="font-mono ml-auto" style={{ color: 'var(--text-tertiary)', fontSize: '10px' }}>{b.short_hash}</span>
          </div>
        ))}
        {remote.length > 0 && (
          <div className="mt-1 pt-1" style={{ borderTop: '1px solid var(--border)' }}>
            <div className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>Remote</div>
            {remote.map((b) => (
              <div key={b.name} className="flex items-center gap-2 text-xs">
                <GitBranch size={11} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
                <span style={{ color: 'var(--text-tertiary)' }}>{b.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PRs tab
// ---------------------------------------------------------------------------

function PRsTab() {
  const { data, isLoading } = useGithubPRs();
  if (isLoading) return <LoadingSpinner />;
  if (!data?.github_auth) return <NoAuthBanner />;
  const items = data?.items ?? [];
  if (items.length === 0) {
    return <EmptyState icon={<GitPullRequest size={28} />} title="No open PRs" description="You have no open pull requests." />;
  }
  return (
    <div className="flex flex-col gap-3">
      {items.map((pr) => (
        <div key={pr.id} className="card" style={{ padding: '14px 16px' }}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <a
                  href={pr.html_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-sm hover:underline"
                  style={{ color: 'var(--accent)' }}
                >
                  {pr.title}
                </a>
                {pr.draft && <span className="chip" style={{ fontSize: '10px' }}>draft</span>}
                {pr.labels.map((l) => (
                  <span key={l} className="chip" style={{ fontSize: '10px' }}>{l}</span>
                ))}
              </div>
              <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                {pr.repo_full_name} · #{pr.number}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{relativeTime(pr.updated_at)}</span>
              <a href={pr.html_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-tertiary)' }}>
                <ExternalLink size={12} />
              </a>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Issues tab
// ---------------------------------------------------------------------------

function IssuesTab() {
  const { data: issueData, isLoading: issuesLoading } = useGithubIssues();
  const { data: milestoneData } = useGithubMilestones();

  if (issuesLoading) return <LoadingSpinner />;
  if (!issueData?.github_auth) return <NoAuthBanner />;

  const issues = issueData?.items ?? [];
  const milestones = milestoneData?.items ?? [];

  return (
    <div className="flex flex-col gap-5">
      {/* Issues */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <CircleDot size={14} style={{ color: 'var(--accent)' }} />
          <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            Assigned Issues
          </span>
          <span className="chip" style={{ fontSize: '10px' }}>{issues.length}</span>
        </div>
        {issues.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No issues assigned to you.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {issues.map((issue) => (
              <div key={issue.id} className="card" style={{ padding: '12px 16px' }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <a
                        href={issue.html_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-sm hover:underline"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {issue.title}
                      </a>
                      {issue.labels.map((l) => (
                        <span key={l} className="chip" style={{ fontSize: '10px' }}>{l}</span>
                      ))}
                      {issue.milestone && (
                        <span className="chip" style={{ fontSize: '10px', background: 'rgba(168,85,247,0.12)', color: '#c084fc' }}>
                          {issue.milestone}
                        </span>
                      )}
                    </div>
                    <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      {issue.repo_full_name} · #{issue.number}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{relativeTime(issue.updated_at)}</span>
                    <a href={issue.html_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-tertiary)' }}>
                      <ExternalLink size={12} />
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Milestones */}
      {milestones.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Milestone size={14} style={{ color: 'var(--accent)' }} />
            <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Open Milestones</span>
          </div>
          <div className="flex flex-col gap-2">
            {milestones.map((m) => (
              <div key={m.id} className="card" style={{ padding: '12px 16px' }}>
                <div className="flex items-center justify-between">
                  <div>
                    <a
                      href={m.html_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-sm hover:underline"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {m.title}
                    </a>
                    <div className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                      {m.repo_full_name} · {m.open_issues} open issues
                      {m.due_on && ` · due ${relativeTime(m.due_on)}`}
                    </div>
                  </div>
                  <ExternalLink size={12} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Activity tab
// ---------------------------------------------------------------------------

function ActivityTab() {
  const [days, setDays] = useState(14);
  const { data: activity = [], isLoading } = useGithubActivity(days);

  const grouped = activity.reduce<Record<string, CommitActivity[]>>((acc, commit) => {
    const date = commit.timestamp ? commit.timestamp.slice(0, 10) : 'Unknown';
    if (!acc[date]) acc[date] = [];
    acc[date].push(commit);
    return acc;
  }, {});

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <GitCommit size={14} style={{ color: 'var(--accent)' }} />
        <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Commit Activity</span>
        <div className="flex gap-1 ml-auto">
          {[7, 14, 30].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className="px-2 py-0.5 rounded text-xs font-medium"
              style={{
                background: days === d ? 'var(--accent)' : 'rgba(255,255,255,0.06)',
                color: days === d ? '#fff' : 'var(--text-secondary)',
                border: '1px solid var(--border)',
                cursor: 'pointer',
              }}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {isLoading && <LoadingSpinner />}
      {!isLoading && activity.length === 0 && (
        <EmptyState icon={<GitCommit size={28} />} title="No commits" description={`No commits in the last ${days} days across configured repos.`} />
      )}
      {!isLoading && Object.entries(grouped).map(([date, commits]) => (
        <div key={date} className="mb-5">
          <div className="text-xs font-semibold mb-2" style={{ color: 'var(--text-tertiary)' }}>{date}</div>
          <div className="flex flex-col gap-1.5">
            {commits.map((c) => (
              <div key={c.hash} className="card" style={{ padding: '10px 14px' }}>
                <div className="flex items-start gap-3">
                  <GitCommit size={12} style={{ color: 'var(--text-tertiary)', flexShrink: 0, marginTop: 2 }} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm" style={{ color: 'var(--text-primary)' }}>{c.subject}</div>
                    <div className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                      <span className="chip" style={{ fontSize: '10px', marginRight: 6 }}>{c.repo}</span>
                      {c.author_name} · {relativeTime(c.timestamp)}
                    </div>
                  </div>
                  <span className="font-mono text-xs flex-shrink-0" style={{ color: 'var(--text-tertiary)' }}>{c.hash.slice(0, 7)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Settings tab
// ---------------------------------------------------------------------------

function SettingsTab() {
  const { data: status } = useGithubStatus();
  const { data: roots = [] } = useGithubRoots();
  const addRoot = useAddRoot();
  const removeRoot = useRemoveRoot();
  const updateRoot = useUpdateRoot();

  const [showForm, setShowForm] = useState(false);
  const [rootName, setRootName] = useState('');
  const [rootPath, setRootPath] = useState('');
  const [formErr, setFormErr] = useState('');

  function handleAdd() {
    setFormErr('');
    if (!rootName.trim()) { setFormErr('Name is required'); return; }
    if (!rootPath.trim()) { setFormErr('Path is required'); return; }
    addRoot.mutate(
      { name: rootName.trim(), path: rootPath.trim() },
      {
        onSuccess: () => {
          setShowForm(false);
          setRootName('');
          setRootPath('');
          setFormErr('');
        },
        onError: (e: Error) => setFormErr(e.message),
      },
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      {/* Auth status */}
      <div className="card" style={{ padding: '16px' }}>
        <div className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>GitHub Authentication</div>
        <div className="flex items-center gap-2 mb-3">
          {status?.token_configured ? (
            <>
              <CheckCircle2 size={14} style={{ color: '#4ade80' }} />
              <span className="text-sm" style={{ color: '#4ade80' }}>
                Token configured {status.github_login && `· @${status.github_login}`}
              </span>
            </>
          ) : (
            <>
              <AlertCircle size={14} style={{ color: '#fbbf24' }} />
              <span className="text-sm" style={{ color: '#fbbf24' }}>No token — PRs and Issues require a GitHub PAT</span>
            </>
          )}
        </div>
        {!status?.token_configured && (
          <div className="rounded p-3 text-xs font-mono" style={{ background: 'rgba(0,0,0,0.3)', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            {'# Add to backend/.env\n'}
            {'# Required PAT scopes: repo, read:user, read:org\n'}
            {'GITHUB_TOKEN=ghp_your_token_here'}
          </div>
        )}
        {status?.rate_limit && (
          <div className="flex items-center gap-2 mt-3 text-xs" style={{ color: 'var(--text-tertiary)' }}>
            <Clock size={11} />
            API rate limit: {status.rate_limit.remaining} / {status.rate_limit.limit} remaining
          </div>
        )}
      </div>

      {/* Repo roots */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Repo Root Paths</div>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium"
            style={{
              background: showForm ? 'rgba(255,255,255,0.06)' : 'var(--accent)',
              color: showForm ? 'var(--text-secondary)' : '#fff',
              border: showForm ? '1px solid var(--border)' : undefined,
              cursor: 'pointer',
            }}
          >
            {showForm ? <X size={11} /> : <Plus size={11} />}
            {showForm ? 'Cancel' : 'Add Root'}
          </button>
        </div>

        {showForm && (
          <div className="card mb-3" style={{ padding: '14px 16px' }}>
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-secondary)' }}>Name</label>
                <input
                  className="input-field w-full"
                  placeholder="e.g. Code Projects"
                  value={rootName}
                  onChange={(e) => setRootName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-secondary)' }}>Path</label>
                <input
                  className="input-field w-full font-mono"
                  placeholder="e.g. /home/user/Code"
                  value={rootPath}
                  onChange={(e) => setRootPath(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                />
              </div>
              {formErr && <p className="text-xs" style={{ color: '#f87171' }}>{formErr}</p>}
              <button
                onClick={handleAdd}
                disabled={addRoot.isPending}
                className="btn-primary self-start text-xs px-4 py-1.5"
              >
                {addRoot.isPending ? 'Adding…' : 'Add Root'}
              </button>
            </div>
          </div>
        )}

        {roots.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
            No root paths configured. Add a directory to start discovering git repos.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {roots.map((root) => (
              <div key={root.id} className="card" style={{ padding: '12px 16px' }}>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{root.name}</div>
                    <div className="text-xs font-mono mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{root.path}</div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => updateRoot.mutate({ id: root.id, data: { enabled: !root.enabled } })}
                      className="text-xs px-2 py-1 rounded"
                      style={{
                        background: root.enabled ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.06)',
                        color: root.enabled ? '#4ade80' : 'var(--text-tertiary)',
                        border: '1px solid var(--border)',
                        cursor: 'pointer',
                      }}
                    >
                      {root.enabled ? 'Enabled' : 'Disabled'}
                    </button>
                    <button
                      onClick={() => removeRoot.mutate(root.id)}
                      style={{ color: '#f87171', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function NoAuthBanner() {
  return (
    <div className="card" style={{ padding: '24px', textAlign: 'center' }}>
      <AlertCircle size={28} style={{ color: '#fbbf24', margin: '0 auto 10px' }} />
      <div className="font-medium text-sm mb-1" style={{ color: 'var(--text-primary)' }}>GitHub token required</div>
      <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
        Add <span className="font-mono">GITHUB_TOKEN</span> to <span className="font-mono">backend/.env</span> to view PRs, issues, and milestones.
      </p>
    </div>
  );
}

function LoadingSpinner({ small }: { small?: boolean }) {
  return (
    <div style={{ padding: small ? '8px 0' : '40px 0', display: 'flex', justifyContent: 'center' }}>
      <RefreshCw size={small ? 14 : 20} className="animate-spin" style={{ color: 'var(--text-tertiary)' }} />
    </div>
  );
}

function EmptyState({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="card" style={{ padding: '40px 24px', textAlign: 'center' }}>
      <div style={{ color: 'var(--text-tertiary)', marginBottom: 12, display: 'flex', justifyContent: 'center' }}>{icon}</div>
      <div className="font-medium text-sm mb-1" style={{ color: 'var(--text-primary)' }}>{title}</div>
      <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{description}</p>
    </div>
  );
}
