import Link from "next/link";
import { notFound } from "next/navigation";
import { GithubImportButton } from "@/components/github-import-button";
import { Header } from "@/components/header";
import { IssueStatusControlCompact } from "@/components/issue-status-control";
import { RunStateProvider } from "@/components/run-state";
import { Starfield } from "@/components/starfield";
import { Pill } from "@/components/ui/pill";
import { SectionHeader } from "@/components/ui/section-header";
import type { TaskPriority, TaskRow, TaskStatus } from "@/lib/db";
import { parseGithubRepo } from "@/lib/github-sync";
import { projectBySlug } from "@/lib/projects-loader";
import { listTasks, priorityRank } from "@/lib/tasks";

export const dynamic = "force-dynamic";

// The five visible kanban columns. `claimed` is grouped under Queued — see
// CLAUDE.md note in lib/db.ts: claimed is the assignment-locked-but-not-yet-
// running phase, not a header users think of.
type ColumnKey = "backlog" | "queued" | "running" | "review" | "done";

const COLUMNS: { key: ColumnKey; label: string; statuses: TaskStatus[] }[] = [
  { key: "backlog", label: "BACKLOG", statuses: ["backlog"] },
  { key: "queued", label: "QUEUED", statuses: ["queued", "claimed"] },
  { key: "running", label: "RUNNING", statuses: ["running"] },
  { key: "review", label: "REVIEW", statuses: ["review"] },
  { key: "done", label: "DONE", statuses: ["done"] },
];

// All statuses surfaced anywhere on the board, including the failed strip.
const BOARD_STATUSES: TaskStatus[] = [
  "backlog",
  "queued",
  "claimed",
  "running",
  "review",
  "done",
  "failed",
];

export default async function ProjectBoardPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const project = projectBySlug(slug);
  if (!project) notFound();

  // Single query, grouped client-side. Pull a generous 200 rows so the
  // board reflects a reasonable history without paginating.
  const tasks = listTasks({
    projectSlug: slug,
    status: BOARD_STATUSES,
    limit: 200,
  });

  const byColumn: Record<ColumnKey, TaskRow[]> = {
    backlog: [],
    queued: [],
    running: [],
    review: [],
    done: [],
  };
  const failed: TaskRow[] = [];

  for (const t of tasks) {
    if (t.status === "failed") {
      failed.push(t);
      continue;
    }
    const col = COLUMNS.find((c) => c.statuses.includes(t.status));
    if (col) byColumn[col.key].push(t);
  }

  for (const key of Object.keys(byColumn) as ColumnKey[]) {
    byColumn[key].sort(sortByPriorityThenCreated);
  }
  failed.sort(sortByPriorityThenCreated);

  // Show the "Import from GitHub" button only when repo-url resolves
  // to a recognized github.com path. parseGithubRepo handles both the
  // https and ssh variants, and trims `.git` suffixes.
  const ghRepo = parseGithubRepo(project.repoUrl);

  return (
    <RunStateProvider>
      <Starfield />
      <Header />
      <main className="max-w-[1400px] mx-auto p-4 space-y-4">
        <header className="flex items-center gap-3 flex-wrap">
          <h1 className="text-xl font-semibold">{project.name}</h1>
          <Pill tone="muted">BOARD</Pill>
          {ghRepo && <GithubImportButton slug={slug} />}
          <Link
            href={`/projects/${encodeURIComponent(slug)}`}
            className="ml-auto mono-label px-2 py-1 border border-border rounded-sm hover:bg-muted/40"
          >
            ← PROJECT DETAIL
          </Link>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          {COLUMNS.map((col) => (
            <Column key={col.key} label={col.label} tasks={byColumn[col.key]} />
          ))}
        </div>

        <FailedStrip tasks={failed} />
      </main>
    </RunStateProvider>
  );
}

function Column({ label, tasks }: { label: string; tasks: TaskRow[] }) {
  return (
    <section className="border border-border rounded-md bg-card/60 px-2 py-2 flex flex-col min-h-[200px]">
      <SectionHeader title={label} meta={`${tasks.length}`} />
      {tasks.length === 0 ? (
        <div className="text-xs text-muted-foreground py-1 px-1">No tasks.</div>
      ) : (
        <ul className="space-y-2 mt-1">
          {tasks.map((t) => (
            <li key={t.id}>
              <Card task={t} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function FailedStrip({ tasks }: { tasks: TaskRow[] }) {
  return (
    <details className="border border-border rounded-md bg-card/40 px-3 py-2">
      <summary className="mono-label text-muted-foreground cursor-pointer flex items-center gap-2">
        <span className="text-[var(--danger)]">◢</span>
        <span className="text-foreground">FAILED</span>
        <span className="text-muted-foreground">· {tasks.length}</span>
      </summary>
      {tasks.length === 0 ? (
        <div className="text-xs text-muted-foreground py-2">
          No failed tasks.
        </div>
      ) : (
        <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 mt-2">
          {tasks.map((t) => (
            <li key={t.id}>
              <Card task={t} />
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}

function Card({ task }: { task: TaskRow }) {
  const labels = parseLabels(task.labels);
  return (
    <article className="border border-border rounded-sm bg-background/60 px-2 py-2 space-y-1.5">
      <Link
        href={taskHref(task)}
        className="block text-xs font-mono leading-snug hover:underline"
      >
        <span className="text-muted-foreground">#{task.id} </span>
        {displayTitle(task)}
      </Link>
      <div className="flex flex-wrap items-center gap-1">
        <Pill tone="muted">@{task.assignee}</Pill>
        {task.repo && (
          <Pill tone="muted" glyph="◇">
            {task.repo}
          </Pill>
        )}
        {task.priority && <PriorityBadge priority={task.priority} />}
        {labels.slice(0, 3).map((l) => (
          <Pill key={l} tone="default">
            {l}
          </Pill>
        ))}
        {labels.length > 3 && (
          <Pill tone="muted">+{labels.length - 3}</Pill>
        )}
      </div>
      <div className="pt-0.5">
        <IssueStatusControlCompact taskId={task.id} status={task.status} />
      </div>
    </article>
  );
}

function PriorityBadge({ priority }: { priority: TaskPriority }) {
  // Tone mapping per roadmap 8.3: low=muted, med=info, high=warn, urgent=bad.
  // The Pill component has no `info` tone, so med maps to the neutral
  // `default` outline, which reads as "informational but not warn".
  const tone =
    priority === "urgent"
      ? "bad"
      : priority === "high"
        ? "warn"
        : priority === "low"
          ? "muted"
          : "default";
  return <Pill tone={tone}>{priority.toUpperCase()}</Pill>;
}

function taskHref(t: TaskRow): string {
  return t.title ? `/issues/${t.id}` : `/tasks/${t.id}`;
}

function displayTitle(t: TaskRow): string {
  if (t.title && t.title.trim().length > 0) return t.title;
  const p = t.prompt.trim();
  return p.length > 60 ? p.slice(0, 60) + "…" : p;
}

function parseLabels(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === "string")
      : [];
  } catch {
    return [];
  }
}

// Sort by priority desc (urgent first), then created_at desc. Ties keep
// the DB-order (which is already created_at desc from listTasks).
function sortByPriorityThenCreated(a: TaskRow, b: TaskRow): number {
  const pr = priorityRank(b.priority) - priorityRank(a.priority);
  if (pr !== 0) return pr;
  return b.created_at - a.created_at;
}
