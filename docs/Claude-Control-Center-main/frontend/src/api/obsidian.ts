import { apiFetch } from './client';

export interface ObsidianVault {
  id: string;
  name: string;
  path: string;
  enabled: boolean;
  last_synced: string | null;
}

export interface ObsidianNote {
  path: string;
  name: string;
  size: number;
  modifiedAt: number;
  tags: string[];
  folder: string;
}

export interface ObsidianNoteContent {
  content: string;
  frontmatter: Record<string, unknown>;
  path: string;
}

export const fetchVaults = (): Promise<ObsidianVault[]> =>
  apiFetch<ObsidianVault[]>('/api/obsidian/vaults');

export const addVault = (name: string, path: string): Promise<ObsidianVault> =>
  apiFetch<ObsidianVault>('/api/obsidian/vaults', {
    method: 'POST',
    body: JSON.stringify({ name, path }),
  });

export const removeVault = (vaultId: string): Promise<{ deleted: boolean }> =>
  apiFetch<{ deleted: boolean }>(`/api/obsidian/vaults/${vaultId}`, { method: 'DELETE' });

export const fetchNotes = (vaultId: string, folder?: string): Promise<ObsidianNote[]> => {
  const params = new URLSearchParams();
  if (folder) params.set('folder', folder);
  const qs = params.toString();
  return apiFetch<ObsidianNote[]>(`/api/obsidian/vaults/${vaultId}/notes${qs ? `?${qs}` : ''}`);
};

export const fetchNote = (
  vaultId: string,
  relativePath: string,
): Promise<ObsidianNoteContent> =>
  apiFetch<ObsidianNoteContent>(
    `/api/obsidian/vaults/${vaultId}/notes/${encodeURIComponent(relativePath)}`,
  );

export const writeNote = (
  vaultId: string,
  relativePath: string,
  content: string,
): Promise<{ path: string; written: boolean }> =>
  apiFetch<{ path: string; written: boolean }>(
    `/api/obsidian/vaults/${vaultId}/notes/${encodeURIComponent(relativePath)}`,
    { method: 'PUT', body: JSON.stringify({ content }) },
  );

export const searchNotes = (vaultId: string, query: string): Promise<ObsidianNote[]> =>
  apiFetch<ObsidianNote[]>(
    `/api/obsidian/vaults/${vaultId}/search?q=${encodeURIComponent(query)}`,
  );

export const triggerVaultIngest = (vaultId: string): Promise<{ triggered: boolean }> =>
  apiFetch<{ triggered: boolean }>(`/api/obsidian/vaults/${vaultId}/ingest`, { method: 'POST' });

export const pushToVault = (
  vaultId: string,
  title: string,
  content: string,
  folder?: string,
  tags?: string[],
): Promise<{ path: string; written: boolean }> =>
  apiFetch<{ path: string; written: boolean }>(`/api/obsidian/vaults/${vaultId}/push`, {
    method: 'POST',
    body: JSON.stringify({ title, content, folder, tags }),
  });

export const fetchVaultSyncStatus = (
  vaultId: string,
): Promise<{ last_synced: string | null; notes_count: number; ready: boolean }> =>
  apiFetch<{ last_synced: string | null; notes_count: number; ready: boolean }>(
    `/api/obsidian/vaults/${vaultId}/sync-status`,
  );
