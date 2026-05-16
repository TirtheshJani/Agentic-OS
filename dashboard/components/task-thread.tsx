"use client";

import { useCallback, useEffect, useState } from "react";

export function TaskThread({ taskId }: { taskId: number }) {
  const [content, setContent] = useState<string>("");
  const [draft, setDraft] = useState<string>("");
  const [posting, setPosting] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/threads/${taskId}`, { cache: "no-store" });
    if (!res.ok) return;
    const j = (await res.json()) as { content: string };
    setContent(j.content);
  }, [taskId]);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      const res = await fetch(`/api/threads/${taskId}`, { cache: "no-store" });
      if (cancelled || !res.ok) return;
      const j = (await res.json()) as { content: string };
      if (!cancelled) setContent(j.content);
    };
    tick();
    const id = setInterval(tick, 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [taskId]);

  const onSend = async () => {
    if (!draft.trim()) return;
    setPosting(true);
    try {
      await fetch(`/api/threads/${taskId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: draft }),
      });
      setDraft("");
      await load();
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="border border-border rounded-md bg-card/60 px-3 py-2">
      <div className="mono-label text-muted-foreground mb-2">THREAD</div>
      <pre className="text-xs whitespace-pre-wrap max-h-64 overflow-y-auto bg-background p-2 rounded-sm border border-border font-mono">
        {content || "(empty)"}
      </pre>
      <div className="flex gap-2 mt-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(); } }}
          placeholder="Append note…"
          disabled={posting}
          className="flex-1 rounded-sm border border-border bg-background p-2 text-xs font-mono"
        />
        <button
          onClick={onSend}
          disabled={posting || !draft.trim()}
          className="rounded-sm border border-border px-3 text-xs font-mono hover:bg-accent/20"
        >
          {posting ? "…" : "SEND"}
        </button>
      </div>
    </div>
  );
}
