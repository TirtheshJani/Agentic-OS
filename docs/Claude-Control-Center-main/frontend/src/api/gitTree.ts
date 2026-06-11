import { apiFetch } from './client';
import type { GitCommit, GitRepo, GitWorktree, GitWorktreeWithRepo } from '../types';

export type { GitCommit, GitRepo, GitWorktree, GitWorktreeWithRepo };

export async function fetchGitRepos(): Promise<GitRepo[]> {
  return apiFetch('/api/git-tree/repos');
}

export async function fetchCommitGraph(repoId: string, limit = 100): Promise<GitCommit[]> {
  const raw = await apiFetch<Record<string, unknown>[]>(
    `/api/git-tree/repos/${encodeURIComponent(repoId)}/graph?limit=${limit}`
  );
  return raw.map((c) => ({
    hash: String(c.hash ?? ''),
    shortHash: String(c.short_hash ?? ''),
    subject: String(c.subject ?? ''),
    authorName: String(c.author_name ?? ''),
    authorEmail: String(c.author_email ?? ''),
    committedAt: String(c.committed_at ?? ''),
    refs: (c.refs as string[]) ?? [],
    parents: (c.parents as string[]) ?? [],
    body: String(c.body ?? ''),
    attribution: (c.attribution as GitCommit['attribution']) ?? 'unknown',
    attributionSources: (c.attribution_sources as string[]) ?? [],
    coAuthors: (c.co_authors as string[]) ?? [],
  }));
}

export async function fetchWorktrees(repoId: string): Promise<GitWorktree[]> {
  const raw = await apiFetch<Record<string, unknown>[]>(
    `/api/git-tree/repos/${encodeURIComponent(repoId)}/worktrees`
  );
  return raw.map(_mapWorktree);
}

export async function fetchAllWorktrees(): Promise<GitWorktreeWithRepo[]> {
  const raw = await apiFetch<Record<string, unknown>[]>('/api/git-tree/all-worktrees');
  return raw.map((r) => ({
    ..._mapWorktree(r),
    repoId: String(r.repo_id ?? ''),
    repoName: String(r.repo_name ?? ''),
  }));
}

function _mapWorktree(r: Record<string, unknown>): GitWorktree {
  return {
    path: String(r.path ?? ''),
    branch: r.branch != null ? String(r.branch) : null,
    headHash: String(r.head_hash ?? ''),
    isMain: Boolean(r.is_main),
    isDetached: Boolean(r.is_detached),
    isLocked: Boolean(r.is_locked),
    lockReason: r.lock_reason != null ? String(r.lock_reason) : null,
    prunable: Boolean(r.prunable),
    isBare: Boolean(r.is_bare),
  };
}

export async function createWorktree(
  repoId: string,
  payload: { dest: string; branch: string; newBranch: boolean }
): Promise<{ path: string; branch: string }> {
  return apiFetch(`/api/git-tree/repos/${encodeURIComponent(repoId)}/worktrees`, {
    method: 'POST',
    body: JSON.stringify({
      dest: payload.dest,
      branch: payload.branch,
      new_branch: payload.newBranch,
    }),
  });
}

export async function removeWorktree(
  repoId: string,
  payload: { path: string; force: boolean }
): Promise<{ removed: boolean }> {
  return apiFetch(`/api/git-tree/repos/${encodeURIComponent(repoId)}/worktrees`, {
    method: 'DELETE',
    body: JSON.stringify(payload),
  });
}

export async function lockWorktree(
  repoId: string,
  payload: { path: string; reason?: string }
): Promise<{ locked: boolean }> {
  return apiFetch(`/api/git-tree/repos/${encodeURIComponent(repoId)}/worktrees/lock`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function unlockWorktree(
  repoId: string,
  payload: { path: string }
): Promise<{ unlocked: boolean }> {
  return apiFetch(`/api/git-tree/repos/${encodeURIComponent(repoId)}/worktrees/unlock`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
