"use client";
import { Field } from "@/components/common/Field";

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

const STATUS_COLORS: Record<Issue["status"], string> = {
  backlog: "bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-300",
  queued: "bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200",
  running: "bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-200",
  review: "bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-200",
  done: "bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-300",
  failed: "bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-200",
};

export function IssueHeader({ issue, crew, onPatch }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3 text-sm">
      <Field label="Status">
        <span className={"inline-block px-2 py-1 rounded text-xs " + STATUS_COLORS[issue.status]}>
          {issue.status}
        </span>
      </Field>
      <Field label="Mode">
        <select
          value={issue.mode}
          onChange={(e) => onPatch({ mode: e.target.value as Issue["mode"] })}
          className="rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-2 py-1 text-sm"
        >
          <option value="async">async</option>
          <option value="sync">sync</option>
        </select>
      </Field>
      <Field label="Assignee">
        <select
          value={issue.assigneeSlug ?? ""}
          onChange={(e) => onPatch({ assigneeSlug: e.target.value || null })}
          className="rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-2 py-1 text-sm w-full"
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
          className="rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-2 py-1 text-sm"
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
          className="rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-2 py-1 text-sm w-full"
        />
      </Field>
    </div>
  );
}
