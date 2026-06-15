"use client";
import clsx from "clsx";
import { Field, Input } from "@/components/common/Field";
import { Select } from "@/components/common/Select";

interface AgentDisplay {
  slug: string;
  name: string;
}

interface Issue {
  id: number;
  status: "backlog" | "queued" | "running" | "review" | "done" | "failed";
  assigneeSlug: string | null;
  priority: number;
  mode: "sync" | "async";
  labels: string[];
}

interface Props {
  issue: Issue;
  crew: AgentDisplay[];
  onPatch: (patch: Partial<Issue>) => void;
}

// dot + text colors per status, plus whether the dot should pulse (live states).
const STATUS_STYLES: Record<Issue["status"], { dot: string; text: string; bg: string; pulse: boolean }> = {
  backlog: { dot: "bg-ink3", text: "text-ink2", bg: "bg-surface2", pulse: false },
  queued: { dot: "bg-accent", text: "text-accent-ink", bg: "bg-accent-bg", pulse: false },
  running: { dot: "bg-ok", text: "text-ok", bg: "bg-ok-bg", pulse: true },
  review: { dot: "bg-warn", text: "text-warn", bg: "bg-warn-bg", pulse: false },
  done: { dot: "bg-ink3", text: "text-ink2", bg: "bg-surface2", pulse: false },
  failed: { dot: "bg-danger", text: "text-danger", bg: "bg-danger-bg", pulse: true },
};

export function IssueHeader({ issue, crew, onPatch }: Props) {
  const s = STATUS_STYLES[issue.status];
  return (
    <div className="grid grid-cols-2 gap-3 text-sm">
      <Field label="Status">
        <span className={clsx("inline-flex items-center gap-2 rounded-pill px-3 py-1 font-label text-xs uppercase tracking-wide", s.bg, s.text)}>
          <span className={clsx("inline-block h-2 w-2 rounded-full", s.dot, s.pulse && "ao-pulse")} />
          {issue.status}
        </span>
      </Field>
      <Field label="Mode">
        <Select
          value={issue.mode}
          onChange={(e) => onPatch({ mode: e.target.value as Issue["mode"] })}
        >
          <option value="async">async</option>
          <option value="sync">sync</option>
        </Select>
      </Field>
      <Field label="Assignee">
        <Select
          fullWidth
          value={issue.assigneeSlug ?? ""}
          onChange={(e) => onPatch({ assigneeSlug: e.target.value || null })}
        >
          <option value="">unassigned</option>
          {crew.map(a => (
            <option key={a.slug} value={a.slug}>{a.name}</option>
          ))}
        </Select>
      </Field>
      <Field label="Priority">
        <Select
          value={issue.priority}
          onChange={(e) => onPatch({ priority: parseInt(e.target.value, 10) })}
        >
          <option value={-1}>Low</option>
          <option value={0}>Normal</option>
          <option value={1}>High</option>
          <option value={2}>Urgent</option>
        </Select>
      </Field>
      <Field label="Labels" hint="Comma-separated">
        <Input
          type="text"
          defaultValue={issue.labels.join(", ")}
          onBlur={(e) => {
            const labels = e.target.value.split(",").map(s => s.trim()).filter(Boolean);
            onPatch({ labels });
          }}
        />
      </Field>
    </div>
  );
}
