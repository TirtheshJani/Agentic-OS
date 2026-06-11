import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryKeys';

export function useGeminiSSE(sessionId?: string) {
  const queryClient = useQueryClient();
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (esRef.current) return;

    const es = new EventSource('/api/gemini/events');
    esRef.current = es;

    const invalidateList = () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.geminiSessions() });
    };

    const invalidateDetail = (id: string) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.geminiSession(id) });
    };

    es.addEventListener('gemini_session_new', () => {
      invalidateList();
    });

    es.addEventListener('gemini_session_updated', (e) => {
      invalidateList();
      try {
        const data = JSON.parse(e.data) as { session_id?: string };
        const sid = data.session_id;
        if (sid && sessionId && sid === sessionId) {
          invalidateDetail(sid);
        } else if (sid) {
          invalidateDetail(sid);
        }
      } catch {
        // ignore parse errors
      }
    });

    es.addEventListener('gemini_session_ended', () => {
      invalidateList();
    });

    return () => {
      es.close();
      esRef.current = null;
    };
  }, [queryClient, sessionId]);
}
