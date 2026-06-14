"use client";
import { Field } from "@/components/common/Field";
import { Pill } from "@/components/common/Pill";

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

type PillTone = "accent" | "ok" | "warn" | "danger" | "neutral";

const STATUS_TONES: Record<Issue["status"], PillTone> = {
  backlog: "neutral",
  queued: "accent",
  running: "ok",
  review: "warn",
  done: "neutral",
  failed: "danger",
};

const selectBase =
  "rounded-card border border-line2 bg-surface text-ink px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-accent-line";

export function IssueHeader({ issue, crew, onPatch }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3 text-sm">
      <Field label="Status">
        <Pill tone={STATUS_TONES[issue.status]}>{issue.status}</Pill>
      </Field>
      <Field label="Mode">
        <select
          value={issue.mode}
          onChange={(e) => onPatch({ mode: e.target.value as Issue["mode"] })}
          className={selectBase}
        >
          <option value="async">async</option>
          <option value="sync">sync</option>
        </select>
      </Field>
      <Field label="Assignee">
        <select
          value={issue.assigneeSlug ?? ""}
          onChange={(e) => onPatch({ assigneeSlug: e.target.value || null })}
          className={selectBase + " w-full"}
        >
          <option value="">unassigned</option>
          {crew.map(a => (
            <option key={a.slug} value={a.slug}>{a.name}</option>
          ))}
        </select>
      </Field>
      <Field label="Priority">
        <select
          value={issue.priority}
          onChange={(e) => onPatch({ priority: parseInt(e.target.value, 10) })}
          className={selectBase}
        >
          <option value={-1}>Low</option>
          <option value={0}>Normal</option>
          <option value={1}>High</option>
          <option value={2}>Urgent</option>
        </select>
      </Field>
      <Field label="Labels" hint="Comma-separated">
        <input
          type="text"
          defaultValue={issue.labels.join(", ")}
          onBlur={(e) => {
            const labels = e.target.value.split(",").map(s => s.trim()).filter(Boolean);
            onPatch({ labels });
          }}
          className={selectBase + " w-full"}
        />
      </Field>
    </div>
  );
}
