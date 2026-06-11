import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  fetchAgentStatus,
  fetchAgents,
  fetchEnvironments,
  fetchSessions,
  createAgent,
  updateAgent,
  deleteAgent,
  createEnvironment,
  updateEnvironment,
  deleteEnvironment,
  createSession,
  sendSessionMessage,
} from '../api/agents';
import type { AgentEvent } from '../types';
import { queryKeys } from '../lib/queryKeys';

export function useAgentStatus() {
  return useQuery({
    queryKey: queryKeys.agentStatus(),
    queryFn: fetchAgentStatus,
    staleTime: 30_000,
  });
}

export function useAgents() {
  return useQuery({
    queryKey: queryKeys.agents(),
    queryFn: fetchAgents,
    staleTime: 30_000,
  });
}

export function useEnvironments() {
  return useQuery({
    queryKey: queryKeys.agentEnvironments(),
    queryFn: fetchEnvironments,
    staleTime: 30_000,
  });
}

export function useSessions(agentId?: string) {
  return useQuery({
    queryKey: queryKeys.agentSessions(agentId),
    queryFn: () => fetchSessions(agentId),
    staleTime: 15_000,
  });
}

export function useAgentMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: queryKeys.agents() });

  return {
    create: useMutation({ mutationFn: createAgent, onSuccess: invalidate }),
    update: useMutation({
      mutationFn: ({ id, data }: { id: string; data: Parameters<typeof updateAgent>[1] }) =>
        updateAgent(id, data),
      onSuccess: invalidate,
    }),
    remove: useMutation({ mutationFn: deleteAgent, onSuccess: invalidate }),
  };
}

export function useEnvironmentMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: queryKeys.agentEnvironments() });

  return {
    create: useMutation({ mutationFn: createEnvironment, onSuccess: invalidate }),
    update: useMutation({
      mutationFn: ({ id, data }: { id: string; data: Parameters<typeof updateEnvironment>[1] }) =>
        updateEnvironment(id, data),
      onSuccess: invalidate,
    }),
    remove: useMutation({ mutationFn: deleteEnvironment, onSuccess: invalidate }),
  };
}

export function useSessionMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: queryKeys.agentSessions() });

  return {
    create: useMutation({ mutationFn: createSession, onSuccess: invalidate }),
    sendMessage: useMutation({
      mutationFn: ({ sessionId, message }: { sessionId: string; message: string }) =>
        sendSessionMessage(sessionId, message),
    }),
  };
}

export function useAgentSSE(sessionId: string | null) {
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const sourceRef = useRef<EventSource | null>(null);

  const clear = useCallback(() => setEvents([]), []);

  useEffect(() => {
    if (!sessionId) return;

    const es = new EventSource(`/api/agents/sessions/${sessionId}/events`);
    sourceRef.current = es;

    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);

    es.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        setEvents((prev) => [...prev, { event: 'message', data, timestamp: new Date().toISOString() }]);
      } catch { /* ignore parse errors */ }
    };

    // Listen for typed events
    for (const eventType of ['tool_use', 'tool_result', 'text', 'error', 'done']) {
      es.addEventListener(eventType, (ev) => {
        try {
          const data = JSON.parse((ev as MessageEvent).data);
          setEvents((prev) => [...prev, { event: eventType, data, timestamp: new Date().toISOString() }]);
        } catch { /* ignore */ }
      });
    }

    return () => {
      es.close();
      sourceRef.current = null;
      setConnected(false);
    };
  }, [sessionId]);

  return { events, connected, clear };
}
