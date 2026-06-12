"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/common/Button";
import { Modal } from "@/components/common/Modal";
import { Field, Input, Textarea } from "@/components/common/Field";
import { EmptyState } from "@/components/common/EmptyState";
import type { LearningTopic } from "@/lib/learning/topics";

interface AgentOption {
  slug: string;
  name: string;
}

export default function LearningPage() {
  const [topics, setTopics] = useState<LearningTopic[] | null>(null);
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [tutor, setTutor] = useState("socratic-tutor");
  const [goals, setGoals] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/learning", { cache: "no-store" });
    if (res.ok) setTopics(((await res.json()) as { topics: LearningTopic[] }).topics);
    const agentsRes = await fetch("/api/agents", { cache: "no-store" });
    if (agentsRes.ok) {
      const data = (await agentsRes.json()) as { agents?: AgentOption[] } | AgentOption[];
      setAgents(Array.isArray(data) ? data : (data.agents ?? []));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/learning", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, tutorSlug: tutor, goals }),
      });
      if (!res.ok) throw new Error(((await res.json()) as { error?: string }).error ?? `HTTP ${res.status}`);
      setCreating(false);
      setTitle("");
      setGoals("");
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="max-w-5xl mx-auto p-6">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-semibold">Learning</h1>
        <Button variant="primary" onClick={() => setCreating(true)}>
          New topic
        </Button>
      </div>
      <p className="text-sm text-ink3 mb-6">
        Topics live in vault/learning/. Sessions are live tutoring runs in the terminal; tutors write session logs back to the vault.
      </p>

      {!topics && <p className="text-sm text-ink3">Loading...</p>}
      {topics && topics.length === 0 && (
        <EmptyState title="No learning topics" description="Create a topic and start a tutoring session." />
      )}
      {topics && topics.length > 0 && (
        <div className="grid md:grid-cols-2 gap-3">
          {topics.map((t) => (
            <Link
              key={t.slug}
              href={`/learning/${t.slug}`}
              className="rounded-md border border-line p-4 hover:bg-surface2"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">{t.title}</span>
                {t.tutorSlug && (
                  <span className="rounded bg-purple-100 dark:bg-purple-950 px-1.5 py-0.5 text-xs text-purple-700 dark:text-purple-300">
                    {t.tutorSlug}
                  </span>
                )}
              </div>
              <p className="text-xs text-ink3 mt-2">
                {t.sessionCount} sessions{t.lastSession ? ` · last ${t.lastSession}` : ""}
                {t.hasSrs ? " · srs" : ""}
              </p>
            </Link>
          ))}
        </div>
      )}

      {creating && (
        <Modal title="New learning topic" onClose={() => setCreating(false)}>
          <div className="space-y-3 p-1">
            <Field label="Topic">
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Linear algebra for QML" />
            </Field>
            <Field label="Tutor" hint="Tutor agents: socratic-tutor, paper-coach, drill-sergeant (or any agent).">
              <select
                value={tutor}
                onChange={(e) => setTutor(e.target.value)}
                className="rounded-md border border-line2 bg-surface px-2 py-1.5 text-sm w-full"
              >
                {(agents.length > 0 ? agents : [{ slug: "socratic-tutor", name: "socratic-tutor" }]).map((a) => (
                  <option key={a.slug} value={a.slug}>
                    {a.slug}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Initial goals (optional)">
              <Textarea value={goals} onChange={(e) => setGoals(e.target.value)} rows={3} placeholder="- [ ] eigenvalues" />
            </Field>
            {error && <p className="text-sm text-danger">{error}</p>}
            <div className="flex gap-2">
              <Button variant="primary" onClick={create} disabled={busy || !title.trim()}>
                {busy ? "Creating..." : "Create"}
              </Button>
              <Button onClick={() => setCreating(false)}>Cancel</Button>
            </div>
          </div>
        </Modal>
      )}
    </main>
  );
}
