"use client";
import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/common/Button";
import type { LearningTopic } from "@/lib/learning/topics";

export default function LearningTopicPage({ params }: { params: Promise<{ topic: string }> }) {
  const { topic } = use(params);
  const [data, setData] = useState<LearningTopic | null>(null);
  const [sessions, setSessions] = useState<Array<{ path: string; title: string }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/learning", { cache: "no-store" });
    if (!res.ok) {
      setError(`HTTP ${res.status}`);
      return;
    }
    const topics = ((await res.json()) as { topics: LearningTopic[] }).topics;
    const found = topics.find((t) => t.slug === topic) ?? null;
    setData(found);
    if (!found) setError("topic not found");
    const list = await fetch(`/api/vault/list?folder=learning`, { cache: "no-store" });
    if (list.ok) {
      const notes = ((await list.json()) as { notes: Array<{ path: string; title: string }> }).notes;
      setSessions(notes.filter((n) => n.path.startsWith(`learning/${topic}/sessions/`)));
    }
  }, [topic]);

  useEffect(() => {
    void load();
  }, [load]);

  async function startSession(kind: "tutor" | "srs-review") {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/learning/${topic}/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind }),
      });
      const body = (await res.json()) as { issueId?: number; error?: string };
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setMessage(`Session issue #${body.issueId} queued. Open it from the Issues board to join the terminal.`);
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (error && !data) return <main className="max-w-5xl mx-auto p-6 text-sm text-red-600">{error}</main>;
  if (!data) return <main className="max-w-5xl mx-auto p-6 text-sm text-gray-500">Loading...</main>;

  return (
    <main className="max-w-5xl mx-auto p-6">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-semibold">{data.title}</h1>
        <div className="flex gap-2">
          <Button variant="primary" onClick={() => startSession("tutor")} disabled={busy}>
            Start session
          </Button>
          <Button onClick={() => startSession("srs-review")} disabled={busy || !data.hasSrs}>
            SRS review
          </Button>
        </div>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        Tutor: {data.tutorSlug ?? "none"} · {data.sessionCount} sessions
      </p>
      {message && <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">{message}</p>}

      <section className="mb-6">
        <h2 className="text-sm font-semibold mb-2">Syllabus</h2>
        <pre className="whitespace-pre-wrap text-sm rounded-md border border-gray-200 dark:border-gray-800 p-3">
          {data.syllabus || "(empty)"}
        </pre>
      </section>

      <section>
        <h2 className="text-sm font-semibold mb-2">Session logs</h2>
        {sessions.length === 0 ? (
          <p className="text-sm text-gray-500">No session logs yet.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {sessions.map((s) => (
              <li key={s.path}>
                <Link href={`/notes?path=${encodeURIComponent(s.path)}`} className="hover:underline">
                  {s.path.split("/").pop()}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
