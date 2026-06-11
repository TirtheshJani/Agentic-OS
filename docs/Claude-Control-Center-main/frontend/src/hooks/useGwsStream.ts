import { useState, useRef, useCallback, useEffect } from 'react';

export interface StreamLine {
  type: 'out' | 'err' | 'info';
  text: string;
}

export interface UseGwsStreamResult {
  lines: StreamLine[];
  running: boolean;
  error: string | null;
  start: (args: string[], source?: string) => void;
  stop: () => void;
  clear: () => void;
}

export function useGwsStream(): UseGwsStreamResult {
  const [lines, setLines] = useState<StreamLine[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    return () => { esRef.current?.close(); };
  }, []);

  const start = useCallback((args: string[], source = 'manual') => {
    esRef.current?.close();
    setLines([]);
    setError(null);
    setRunning(true);

    const qs = args.map((a) => `args=${encodeURIComponent(a)}`).join('&') + `&source=${encodeURIComponent(source)}`;
    const es = new EventSource(`/api/gws/execute/stream?${qs}`);
    esRef.current = es;

    es.onmessage = (e) => {
      if (e.data === '[done]') {
        setRunning(false);
        es.close();
      } else if (e.data === '[timeout]') {
        setError('Command timed out');
        setRunning(false);
        es.close();
      } else if (e.data.startsWith('[error]')) {
        setError(e.data.replace('[error] ', ''));
        setRunning(false);
        es.close();
      } else {
        setLines((prev) => [...prev, { type: 'out', text: e.data }]);
      }
    };

    es.onerror = () => {
      setError('Connection error');
      setRunning(false);
      es.close();
    };
  }, []);

  const stop = useCallback(() => {
    esRef.current?.close();
    setRunning(false);
  }, []);

  const clear = useCallback(() => {
    setLines([]);
    setError(null);
  }, []);

  return { lines, running, error, start, stop, clear };
}
