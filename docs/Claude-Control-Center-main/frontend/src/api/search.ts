import { apiFetch } from './client';

export interface ConversationHit {
  projectId: string;
  projectName: string;
  sessionId: string;
  slug: string | null;
  matchCount: number;
  lastMessageAt: string | null;
  snippet: string;
  messageUuid: string | null;
}

export interface MemoryHit {
  projectId: string;
  projectName: string;
  filename: string;
  name: string;
  snippet: string;
}

export interface SearchResults {
  conversations: ConversationHit[];
  memory: MemoryHit[];
}

export const fetchSearch = (q: string) =>
  apiFetch<SearchResults>(`/api/search?q=${encodeURIComponent(q)}`);
