import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { formatDistanceToNow, format } from 'date-fns';
import type { Message } from '../types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function relativeTime(ts: string | number | null): string {
  if (!ts) return '—';
  try {
    const date = typeof ts === 'number' ? new Date(ts) : new Date(ts);
    return formatDistanceToNow(date, { addSuffix: true });
  } catch {
    return '—';
  }
}

export function absoluteTime(ts: string | number | null): string {
  if (!ts) return '—';
  try {
    const date = typeof ts === 'number' ? new Date(ts) : new Date(ts);
    return format(date, 'MMM d, yyyy HH:mm');
  } catch {
    return '—';
  }
}

export function shortTime(ts: string | number | null): string {
  if (!ts) return '—';
  try {
    const date = typeof ts === 'number' ? new Date(ts) : new Date(ts);
    return format(date, 'HH:mm');
  } catch {
    return '—';
  }
}

/** Sort messages by timestamp for linear display. */
export function buildMessageTree(messages: Message[]): Message[] {
  return [...messages].sort((a, b) => {
    if (!a.timestamp) return -1;
    if (!b.timestamp) return 1;
    return a.timestamp.localeCompare(b.timestamp);
  });
}

export function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + '…';
}

export function shortPath(path: string | null): string {
  if (!path) return '';
  const parts = path.split('/').filter(Boolean);
  if (parts.length <= 2) return path;
  return '…/' + parts.slice(-2).join('/');
}

export function sessionLabel(session: { slug?: string | null; sessionId: string }): string {
  return session.slug || session.sessionId.slice(0, 8);
}

export function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
