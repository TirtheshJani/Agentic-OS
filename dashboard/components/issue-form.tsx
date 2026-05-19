"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import type { Project } from "@/lib/projects-loader";
import type { Agent } from "@/lib/agents-loader";

type Priority = "low" | "med" | "high" | "urgent";
const PRIORITIES: Priority[] = ["low", "med", "high", "urgent"];

type Props = {
  projects: Project[];
  agents: Agent[];
};

export function IssueForm({ projects, agents }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [projectSlug, setProjectSlug] = useState<string>("");
  const [repo, setRepo] = useState<string>("");
  const [assignee, setAssignee] = useState<string>("user");
  const [priority, setPriority] = useState<Priority>("med");
  const [labels, setLabels] = useState<string[]>([]);
  const [labelDraft, setLabelDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const project = projects.find((p) => p.slug === projectSlug) ?? null;
  const projectCaps = project?.capabilities ?? [];
  const inScope = (dept: string) =>
    !project || projectCaps.length === 0 || projectCaps.includes(dept);

  const onProjectChange = (slug: string) => {
    setProjectSlug(slug);
    const p = projects.find((x) => x.slug === slug);
    setRepo(p?.repoUrl ?? "");
  };

  const onLabelKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "," || e.key === "Enter") {
      e.preventDefault();
      const v = labelDraft.trim().replace(/,$/, "");
      if (v && !labels.includes(v)) setLabels([...labels, v]);
      setLabelDraft("");
    } else if (e.key === "Backspace" && labelDraft === "" && labels.length > 0) {
      setLabels(labels.slice(0, -1));
    }
  };

  const removeLabel = (l: string) => setLabels(labels.filter((x) => x !== l));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("title is required");
      return;
    }
    setSubmitting(true);
    setError(null);
    const agentRow = agents.find((a) => a.name === assignee) ?? null;
    const department = agentRow?.department ?? null;
    const payload = {
      prompt: body,
      title: title.trim(),
      assignee,
      department,
      projectSlug: projectSlug || null,
      repo: repo.trim() || null,
      priority,
      labels,
      githubUrl: null,
      githubNumber: null,
      status: "backlog" as const,
    };
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = (await res.json()) as { id?: number; error?: string };
      if (!res.ok || typeof j.id !== "number") {
        setError(j.error ?? `request failed (${res.status})`);
        setSubmitting(false);
        return;
      }
      router.push(`/issues/${j.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="border border-border rounded-md bg-card/60 px-3 py-2 space-y-3">
        <div>
          <label htmlFor="issue-title" className="mono-label text-muted-foreground">
            TITLE · required
          </label>
          <input
            id="issue-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={submitting}
            placeholder="short summary"
            className="mt-1 w-full rounded-sm border border-border bg-background p-2 text-sm font-mono"
            autoFocus
          />
        </div>

        <div>
          <label htmlFor="issue-body" className="mono-label text-muted-foreground">
            BODY · markdown · used as task prompt
          </label>
          <textarea
            id="issue-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            disabled={submitting}
            rows={8}
            placeholder="describe what needs to happen"
            className="mt-1 w-full rounded-sm border border-border bg-background p-2 text-sm font-mono"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label htmlFor="issue-project" className="mono-label text-muted-foreground">
              PROJECT · optional
            </label>
            <select
              id="issue-project"
              value={projectSlug}
              onChange={(e) => onProjectChange(e.target.value)}
              disabled={submitting}
              className="mt-1 w-full rounded-sm border border-border bg-background p-2 text-sm font-mono"
            >
              <option value="">(none)</option>
              {projects.map((p) => (
                <option key={p.slug} value={p.slug}>
                  {p.name} · {p.slug}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="issue-repo" className="mono-label text-muted-foreground">
              REPO · optional
            </label>
            <input
              id="issue-repo"
              value={repo}
              onChange={(e) => setRepo(e.target.value)}
              disabled={submitting}
              placeholder="owner/name or url"
              className="mt-1 w-full rounded-sm border border-border bg-background p-2 text-sm font-mono"
            />
          </div>
        </div>

        <div>
          <label htmlFor="issue-assignee" className="mono-label text-muted-foreground">
            ASSIGN TO
          </label>
          <select
            id="issue-assignee"
            value={assignee}
            onChange={(e) => setAssignee(e.target.value)}
            disabled={submitting}
            className="mt-1 w-full rounded-sm border border-border bg-background p-2 text-sm font-mono"
          >
            <option value="user">user (run immediately when queued)</option>
            <optgroup label="Departments">
              {["research", "coding", "content", "business", "productivity"]
                .filter(inScope)
                .map((d) => (
                  <option key={d} value={`lead:${d}`}>
                    @{d}
                  </option>
                ))}
            </optgroup>
            <optgroup label="Agents">
              {agents
                .filter((a) => inScope(a.department))
                .map((a) => (
                  <option key={a.name} value={a.name}>
                    @{a.name} · {a.department}
                  </option>
                ))}
            </optgroup>
          </select>
        </div>

        <div>
          <span className="mono-label text-muted-foreground">PRIORITY</span>
          <div className="mt-1 flex gap-2">
            {PRIORITIES.map((p) => (
              <label
                key={p}
                className={`cursor-pointer border rounded-sm px-2 py-1 text-xs font-mono ${
                  priority === p
                    ? "border-foreground text-foreground"
                    : "border-border text-muted-foreground"
                }`}
              >
                <input
                  type="radio"
                  name="priority"
                  value={p}
                  checked={priority === p}
                  onChange={() => setPriority(p)}
                  disabled={submitting}
                  className="sr-only"
                />
                {p.toUpperCase()}
              </label>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="issue-labels" className="mono-label text-muted-foreground">
            LABELS · comma to add
          </label>
          <div className="mt-1 flex flex-wrap gap-1 border border-border bg-background rounded-sm p-2">
            {labels.map((l) => (
              <span
                key={l}
                className="inline-flex items-center gap-1 border border-border rounded-sm px-1.5 py-0.5 text-xs font-mono"
              >
                {l}
                <button
                  type="button"
                  onClick={() => removeLabel(l)}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label={`remove ${l}`}
                >
                  ×
                </button>
              </span>
            ))}
            <input
              id="issue-labels"
              value={labelDraft}
              onChange={(e) => setLabelDraft(e.target.value)}
              onKeyDown={onLabelKey}
              disabled={submitting}
              placeholder={labels.length === 0 ? "bug, p1, …" : ""}
              className="flex-1 min-w-[6rem] bg-transparent text-xs font-mono outline-none"
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="text-xs font-mono text-[var(--danger)] border border-[var(--danger)] rounded-sm px-2 py-1">
          {error}
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={submitting || !title.trim()} aria-busy={submitting}>
          {submitting ? "FILING…" : "FILE ISSUE"}
        </Button>
        <Pill tone="muted">→ BACKLOG</Pill>
        <span className="text-xs text-muted-foreground font-mono">
          flip to QUEUED later to dispatch.
        </span>
      </div>
    </form>
  );
}
