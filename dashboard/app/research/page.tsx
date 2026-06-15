"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/common/Button";
import { Modal } from "@/components/common/Modal";
import { Field, Input, Textarea } from "@/components/common/Field";
import { EmptyState } from "@/components/common/EmptyState";
import { SectionHeader } from "@/components/common/SectionHeader";
import type { ResearchProject } from "@/lib/research/projects";

export default function ResearchPage() {
  const [projects, setProjects] = useState<ResearchProject[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [question, setQuestion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/research", { cache: "no-store" });
    if (res.ok) setProjects(((await res.json()) as { projects: ResearchProject[] }).projects);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, question }),
      });
      if (!res.ok) throw new Error(((await res.json()) as { error?: string }).error ?? `HTTP ${res.status}`);
      setCreating(false);
      setTitle("");
      setQuestion("");
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="max-w-5xl mx-auto p-6">
      <SectionHeader
        kicker="DEEP WORK"
        title="Research"
        description="Research projects live in vault/research/. Sources are collected by agents; chat is grounded in the project folder."
        action={
          <Button variant="primary" onClick={() => setCreating(true)}>
            New research project
          </Button>
        }
      />

      {!projects && <p className="text-sm text-ink3">Loading...</p>}
      {projects && projects.length === 0 && (
        <EmptyState title="No research projects" description="Create one and dispatch a collection run." />
      )}
      {projects && projects.length > 0 && (
        <div className="grid md:grid-cols-2 gap-3">
          {projects.map((p) => (
            <Link
              key={p.slug}
              href={`/research/${p.slug}`}
              className="rounded-card border border-line bg-surface p-4 transition-colors hover:border-accent-line"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-sm text-ink">{p.title}</span>
                <span className="rounded-pill bg-surface2 px-2 py-0.5 font-label text-[9px] uppercase tracking-wide text-ink2">
                  {p.status}
                </span>
              </div>
              <p className="text-sm text-ink3 mt-1 line-clamp-2">{p.question}</p>
              <p className="text-xs text-ink3 mt-2">
                {p.sourceCount} sources · {p.noteCount} notes{p.briefExists ? " · brief" : ""}
              </p>
            </Link>
          ))}
        </div>
      )}

      {creating && (
        <Modal title="New research project" onClose={() => setCreating(false)}>
          <div className="space-y-3 p-1">
            <Field label="Title">
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Quantum ML for diagnostics" />
            </Field>
            <Field label="Research question">
              <Textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                rows={3}
                placeholder="What is the state of the art in...?"
              />
            </Field>
            {error && <p className="text-sm text-danger">{error}</p>}
            <div className="flex gap-2">
              <Button variant="primary" onClick={create} disabled={busy || !title.trim() || !question.trim()}>
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
