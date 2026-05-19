import { redirect, notFound } from "next/navigation";
import { Starfield } from "@/components/starfield";
import { Header } from "@/components/header";
import { RunStateProvider } from "@/components/run-state";
import { TaskChain } from "@/components/task-chain";
import { TaskThread } from "@/components/task-thread";
import { IssueStatusControl } from "@/components/issue-status-control";
import { IssueLaunchButtons } from "@/components/issue-launch-buttons";
import { Pill } from "@/components/ui/pill";
import { PriorityBadge } from "@/components/priority-badge";
import { agentByName } from "@/lib/agents-loader";
import { getTask, runsForTask } from "@/lib/tasks";
import { parseLabels } from "@/lib/ui-utils";

export const dynamic = "force-dynamic";

// `YYYY-MM-DD HH:MM` for the metadata grid. The board page uses a
// shorter `hhmm` (time-only); these are different functions on purpose.
function localDateTime(ts: number): string {
  const d = new Date(ts);
  return `${d.toISOString().slice(0, 10)} ${d.toTimeString().slice(0, 5)}`;
}

export default async function IssueDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const n = Number(id);
  if (!Number.isFinite(n) || n <= 0) notFound();
  const task = getTask(n);
  if (!task) notFound();

  // Issues UI is for titled rows. Prompt-only legacy tasks stay on the
  // existing /tasks/[id] view so we don't repurpose plain prompts.
  if (!task.title) redirect(`/tasks/${task.id}`);

  const labels = parseLabels(task.labels);
  const runs = runsForTask(task.id, 25);
  // assignee may be "user", "lead:<dept>", or an agent name. Only resolve
  // for plain agent names; "user" and "lead:..." cannot have a default-repo.
  const assigneeAgent =
    task.assignee !== "user" && !task.assignee.startsWith("lead:")
      ? agentByName(task.assignee)
      : null;

  return (
    <RunStateProvider>
      <Starfield />
      <Header />
      <main className="max-w-5xl mx-auto p-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
        <section className="lg:col-span-2 space-y-4">
          <div className="border border-border rounded-md bg-card/60 px-4 py-3">
            <div className="mono-label text-muted-foreground">ISSUE · {task.id}</div>
            <h1 className="text-lg font-mono font-semibold mt-1 text-foreground">
              {task.title}
            </h1>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <Pill tone="muted">@{task.assignee}</Pill>
              {task.repo && <Pill tone="muted" glyph="◇">{task.repo}</Pill>}
              {task.project_slug && (
                <Pill tone="muted" glyph="◆">{task.project_slug}</Pill>
              )}
              <PriorityBadge priority={task.priority} uppercase />
              {labels.map((l) => (
                <Pill key={l} tone="default">{l}</Pill>
              ))}
              {task.github_url && task.github_number !== null && (
                <a
                  href={task.github_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mono-label text-muted-foreground hover:text-foreground border border-border rounded-sm px-1.5 py-0.5"
                >
                  GH#{task.github_number} ↗
                </a>
              )}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <IssueStatusControl taskId={task.id} status={task.status} />
              <IssueLaunchButtons
                taskId={task.id}
                assignee={task.assignee}
                prompt={task.prompt}
                projectSlug={task.project_slug}
                defaultRepo={assigneeAgent?.defaultRepo ?? null}
              />
            </div>
          </div>

          <div className="border border-border rounded-md bg-card/60 px-4 py-3">
            <div className="mono-label text-muted-foreground">BODY</div>
            {task.prompt.trim().length === 0 ? (
              <div className="text-xs text-muted-foreground mt-1">(empty)</div>
            ) : (
              // Intentionally plain text, no markdown lib. Whitespace preserved.
              <pre className="whitespace-pre-wrap text-sm font-mono mt-2">
                {task.prompt}
              </pre>
            )}
          </div>

          <TaskChain taskId={task.id} />
          <TaskThread taskId={task.id} />
        </section>

        <aside className="space-y-4">
          <div className="border border-border rounded-md bg-card/60 px-3 py-2">
            <div className="mono-label text-muted-foreground">META</div>
            <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs font-mono">
              <dt className="text-muted-foreground">created</dt>
              <dd>{localDateTime(task.created_at)}</dd>
              {task.started_at !== null && (
                <>
                  <dt className="text-muted-foreground">started</dt>
                  <dd>{localDateTime(task.started_at)}</dd>
                </>
              )}
              {task.finished_at !== null && (
                <>
                  <dt className="text-muted-foreground">finished</dt>
                  <dd>{localDateTime(task.finished_at)}</dd>
                </>
              )}
              {task.department && (
                <>
                  <dt className="text-muted-foreground">dept</dt>
                  <dd>{task.department}</dd>
                </>
              )}
              {task.run_id !== null && (
                <>
                  <dt className="text-muted-foreground">run</dt>
                  <dd>#{task.run_id}</dd>
                </>
              )}
              {task.parent_task_id !== null && (
                <>
                  <dt className="text-muted-foreground">parent</dt>
                  <dd>#{task.parent_task_id}</dd>
                </>
              )}
            </dl>
            {task.error && (
              <pre className="mt-2 text-xs font-mono whitespace-pre-wrap text-[var(--danger)] border border-[var(--danger)] rounded-sm p-2">
                {task.error}
              </pre>
            )}
          </div>

          <div className="border border-border rounded-md bg-card/60 px-3 py-2">
            <div className="mono-label text-muted-foreground">RUN HISTORY</div>
            {runs.length === 0 ? (
              <div className="text-xs text-muted-foreground mt-1">No runs yet.</div>
            ) : (
              <ul className="mt-1 space-y-0.5">
                {runs.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-center gap-2 text-xs font-mono"
                  >
                    <span className="text-muted-foreground">#{r.id}</span>
                    <span className="truncate">{r.skill_slug}</span>
                    <Pill tone={r.status === "done" ? "good" : r.status === "error" ? "bad" : "warn"}>
                      {r.status.toUpperCase()}
                    </Pill>
                    {r.duration_ms !== null && (
                      <span className="text-muted-foreground ml-auto">
                        {Math.round(r.duration_ms / 1000)}s
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </main>
    </RunStateProvider>
  );
}
