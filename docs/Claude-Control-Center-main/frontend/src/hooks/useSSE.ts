import { useEffect, useState } from 'react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryKeys';

let connectedState = false;
let backoffMs = 1000;
let subscribers = 0;
let reconnectTimer: number | null = null;
let eventSource: EventSource | null = null;
let activeQueryClient: QueryClient | null = null;

const listeners = new Set<(connected: boolean) => void>();

function setConnectedState(next: boolean) {
  connectedState = next;
  listeners.forEach((listener) => listener(next));
}

function clearReconnectTimer() {
  if (reconnectTimer !== null) {
    window.clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function invalidateSessionQueries(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: queryKeys.activeSessions() });
  queryClient.invalidateQueries({ queryKey: queryKeys.dashboardFleet() });
  queryClient.invalidateQueries({ queryKey: queryKeys.projects() });
  queryClient.invalidateQueries({ queryKey: queryKeys.agentViewAgents() });
}

function invalidateMessageQueries(
  queryClient: QueryClient,
  payload: { projectId?: string; sessionId?: string }
) {
  if (payload.projectId && payload.sessionId) {
    queryClient.invalidateQueries({
      queryKey: queryKeys.messages(payload.projectId, payload.sessionId),
    });
  }
  queryClient.invalidateQueries({ queryKey: queryKeys.sessions(payload.projectId) });
  queryClient.invalidateQueries({ queryKey: queryKeys.projects() });
}

function closeConnection() {
  clearReconnectTimer();
  eventSource?.close();
  eventSource = null;
  setConnectedState(false);
}

function scheduleReconnect() {
  clearReconnectTimer();
  const delay = Math.min(backoffMs, 30_000);
  backoffMs = delay * 2;
  reconnectTimer = window.setTimeout(() => {
    reconnectTimer = null;
    ensureConnection();
  }, delay);
}

function ensureConnection() {
  if (eventSource || subscribers === 0) return;

  const es = new EventSource('/api/events');
  eventSource = es;

  es.addEventListener('open', () => {
    if (eventSource !== es) return;
    setConnectedState(true);
    backoffMs = 1000;
  });

  es.addEventListener('ping', () => {
    if (eventSource === es) {
      setConnectedState(true);
    }
  });

  es.addEventListener('session_update', () => {
    if (activeQueryClient) {
      invalidateSessionQueries(activeQueryClient);
    }
  });

  es.addEventListener('video_research_update', () => {
    if (activeQueryClient) {
      activeQueryClient.invalidateQueries({ queryKey: queryKeys.videoResearchJobs() });
      activeQueryClient.invalidateQueries({ queryKey: ['video-research-job'] });
    }
  });

  es.addEventListener('message_update', (event) => {
    if (!activeQueryClient) return;
    try {
      const data = JSON.parse(event.data) as { projectId?: string; sessionId?: string };
      invalidateMessageQueries(activeQueryClient, data);
    } catch {
      // ignore malformed payloads
    }
  });

  es.addEventListener('error', () => {
    if (eventSource !== es) return;
    es.close();
    eventSource = null;
    setConnectedState(false);
    if (subscribers > 0) {
      scheduleReconnect();
    }
  });
}

export function useSSE() {
  const queryClient = useQueryClient();
  const [connected, setConnected] = useState(connectedState);

  useEffect(() => {
    activeQueryClient = queryClient;
    subscribers += 1;
    listeners.add(setConnected);
    ensureConnection();

    return () => {
      listeners.delete(setConnected);
      subscribers = Math.max(0, subscribers - 1);
      if (subscribers === 0) {
        activeQueryClient = null;
        closeConnection();
      }
    };
  }, [queryClient]);

  return { connected };
}
