"use client";
import { useState } from "react";
import { Modal } from "@/components/common/Modal";
import { Field, Input, Textarea } from "@/components/common/Field";
import { Button } from "@/components/common/Button";

interface AgentDisplay {
  slug: string;
  name: string;
}

interface Props {
  projectSlug: string;
  crew: AgentDisplay[];
  onClose: () => void;
}

export function NewIssueDialog({ projectSlug, crew, onClose }: Props) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [assignee, setAssignee] = useState<string>("");
  const [priority, setPriority] = useState(0);
  const [mode, setMode] = useState<"async" | "sync">("async");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/issues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectSlug,
          title,
          body,
          assigneeSlug: assignee || null,
          priority,
          mode,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      title="New Issue"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit} disabled={submitting || title.trim().length === 0}>
            {submitting ? "Creating..." : "Create"}
          </Button>
        </>
      }
    >
      <Field label="Title">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
      </Field>
      <Field label="Body" hint="Markdown supported. This becomes the agent's opening prompt.">
        <Textarea rows={6} value={body} onChange={(e) => setBody(e.target.value)} />
      </Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Assignee">
          <select
            value={assignee}
            onChange={(e) => setAssignee(e.target.value)}
            className="w-full rounded-md border border-line2 bg-surface2 px-2 py-1.5 text-sm text-ink2"
          >
            <option value="">unassigned</option>
            {crew.map(a => <option key={a.slug} value={a.slug}>{a.name}</option>)}
          </select>
        </Field>
        <Field label="Priority">
          <select
            value={priority}
            onChange={(e) => setPriority(parseInt(e.target.value, 10))}
            className="w-full rounded-md border border-line2 bg-surface2 px-2 py-1.5 text-sm text-ink2"
          >
            <option value={-1}>Low</option>
            <option value={0}>Normal</option>
            <option value={1}>High</option>
            <option value={2}>Urgent</option>
          </select>
        </Field>
        <Field label="Mode">
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as any)}
            className="w-full rounded-md border border-line2 bg-surface2 px-2 py-1.5 text-sm text-ink2"
          >
            <option value="async">async</option>
            <option value="sync">sync</option>
          </select>
        </Field>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
    </Modal>
  );
}
