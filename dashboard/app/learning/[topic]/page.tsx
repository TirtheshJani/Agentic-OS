"use client";
import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/common/Button";
import { SectionHeader } from "@/components/common/SectionHeader";
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

  if (error && !data) return <main className="max-w-5xl mx-auto p-6 text-sm text-danger">{error}</main>;
  if (!data) return <main className="max-w-5xl mx-auto p-6 text-sm text-ink3">Loading...</main>;

  return (
    <main className="max-w-5xl mx-auto p-6">
      <SectionHeader
        kicker="TUTOR"
        title={data.title}
        description={`Tutor: ${data.tutorSlug ?? "none"} · ${data.sessionCount} sessions`}
        action={
          <div className="flex gap-2">
            <Button variant="primary" onClick={() => startSession("tutor")} disabled={busy}>
              Start session
            </Button>
            <Button onClick={() => startSession("srs-review")} disabled={busy || !data.hasSrs}>
              SRS review
            </Button>
          </div>
        }
      />
      {message && <p className="text-sm text-ink2 mb-4">{message}</p>}

      <section className="mb-6">
        <h2 className="font-label uppercase tracking-wide text-[11px] text-ink3 mb-2">Syllabus</h2>
        <pre className="whitespace-pre-wrap text-sm rounded-card border border-line bg-surface p-4 text-ink2">
          {data.syllabus || "(empty)"}
        </pre>
      </section>

      <section>
        <h2 className="font-label uppercase tracking-wide text-[11px] text-ink3 mb-2">Session logs</h2>
        {sessions.length === 0 ? (
          <p className="text-sm text-ink3">No session logs yet.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {sessions.map((s) => (
              <li key={s.path}>
                <Link
                  href={`/notes?path=${encodeURIComponent(s.path)}`}
                  className="text-accent hover:underline"
                >
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
