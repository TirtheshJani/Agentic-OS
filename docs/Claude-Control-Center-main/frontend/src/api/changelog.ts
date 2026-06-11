import { apiFetch } from './client';

export interface ReleaseEntry {
  version: string;
  items: string[];
}

export interface WhatsNewEntry {
  id: string;
  week: number;
  label: string;
  date: string;
  tags: string[];
  content: string; // sanitised inner HTML
}

export async function fetchReleases(): Promise<ReleaseEntry[]> {
  return apiFetch<ReleaseEntry[]>('/api/changelog/releases');
}

export async function refreshReleases(): Promise<ReleaseEntry[]> {
  return apiFetch<ReleaseEntry[]>('/api/changelog/releases/refresh', { method: 'POST' });
}

export async function fetchWhatsNew(): Promise<WhatsNewEntry[]> {
  return apiFetch<WhatsNewEntry[]>('/api/changelog/whats-new');
}

export async function refreshWhatsNew(): Promise<WhatsNewEntry[]> {
  return apiFetch<WhatsNewEntry[]>('/api/changelog/whats-new/refresh', { method: 'POST' });
}
