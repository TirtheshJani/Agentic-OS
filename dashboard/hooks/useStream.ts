// dashboard/hooks/useStream.ts
"use client";
import { useEffect, useRef } from "react";

export type StreamEventKind =
  | "ping"
  | "project.changed"
  | "agent.changed"
  | "issue.changed"
  | "thread.appended"
  | "vault.indexed"
  | "project.create.progress"
  | "project.create.done"
  | "rag.embeddings"
  | "run.finalized"
  | "sessions.indexed";

export interface StreamEventPayload {
  kind: StreamEventKind;
  [k: string]: unknown;
}

export function useStream(handler: (event: StreamEventPayload) => void) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const es = new EventSource("/api/stream");
    es.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        handlerRef.current(data);
      } catch (err) {
        console.warn("[useStream] bad payload:", err);
      }
    };
    es.onerror = () => {
      // Browser will auto-reconnect. Nothing to do.
    };
    return () => {
      es.close();
    };
  }, []);
}
