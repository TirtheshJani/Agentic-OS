import { apiFetch } from './client';

export type NewsSource = 'x' | 'news' | 'reddit';

export interface NewsItem {
  id: string;
  source: NewsSource;
  title: string;
  url: string;
  summary: string;
  author: string;
  timestamp: string;
  score: number | null;
}

export interface NewsFeed {
  items: NewsItem[];
  refreshed_at: string | null;
}

export interface VideoIdea {
  id: string;
  kind: 'video';
  title: string;
  hook?: string;
  audience?: string;
  why_now?: string;
}

export interface LearningIdea {
  id: string;
  kind: 'learning';
  title: string;
  format?: string;
  outline?: string;
  level?: string;
}

export interface NewsIdeas {
  video: VideoIdea[];
  learning: LearningIdea[];
  generated_at: string | null;
}

export interface NewsSourcesStatus {
  x: { available: boolean; configured: boolean; handle: string };
  news: { available: boolean; configured: boolean; feed_count: number };
  reddit: { available: boolean; configured: boolean; subreddits: string[] };
  ideas: { available: boolean; configured: boolean; model: string };
}

export const fetchNewsFeed = (): Promise<NewsFeed> =>
  apiFetch<NewsFeed>('/api/news/feed');

export const refreshNews = (): Promise<NewsFeed> =>
  apiFetch<NewsFeed>('/api/news/refresh', { method: 'POST' });

export const fetchNewsIdeas = (): Promise<NewsIdeas> =>
  apiFetch<NewsIdeas>('/api/news/ideas');

export const generateNewsIdeas = (kinds: Array<'video' | 'learning'>): Promise<NewsIdeas> =>
  apiFetch<NewsIdeas>('/api/news/ideas/generate', {
    method: 'POST',
    body: JSON.stringify({ kinds }),
  });

export const exportNewsIdea = (
  vaultId: string,
  idea: VideoIdea | LearningIdea,
): Promise<{ exported: boolean; note: { path: string } }> =>
  apiFetch('/api/news/ideas/export', {
    method: 'POST',
    body: JSON.stringify({ vault_id: vaultId, idea }),
  });

export const fetchNewsSources = (): Promise<NewsSourcesStatus> =>
  apiFetch<NewsSourcesStatus>('/api/news/sources/status');
