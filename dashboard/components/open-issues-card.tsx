import Link from "next/link";
import { Pill } from "@/components/ui/pill";
import { SectionHeader } from "@/components/ui/section-header";
import type { TaskPriority, TaskRow, TaskStatus } from "@/lib/db";
import { loadProjects, type Project } from "@/lib/projects-loader";
import { listTasks, priorityRank } from "@/lib/tasks";

// Statuses we consider "open" for the home rail. Failed and done are
// excluded — those have their own surfaces (failed strip on the board,
// recent-runs for completions).
const OPEN_STATUSES: TaskStatus[] = [
  "backlog",
  "queued",
  "claimed",
  "running",
  "review",
];

const TOP_N = 3;

export function OpenIssuesCard() {
  const projects = loadProjects();
  const projectBySlug = new Map(projects.map((p) => [p.slug, p]));

  // One query for everything; group + sort in memory. Cheap at the
  // scale of a personal dashboard, and avoids fanning out N queries.
  const openTasks = listTasks({
    status: OPEN_STATUSES,
    limit: 500,
  });

  const counts = new Map<string, number>();
  for (const t of openTasks) {
    if (!t.project_slug) continue;
    counts.set(t.project_slug, (counts.get(t.project_slug) ?? 0) + 1);
  }

  // Project rows sorted by count desc, then name asc. Skip any project
  // slug we don't recognize (orphaned tasks from deleted projects) so
  // the link target is always valid.
  const projectRows = [...counts.entries()]
    .map(([slug, count]) => ({ slug, count, project: projectBySlug.get(slug) }))
    .filter((r): r is { slug: string; count: number; project: Project } =>
      Boolean(r.project)
    )
    .sort((a, b) => b.count - a.count || a.project.name.localeCompare(b.project.name));

  const topByPriority = [...openTasks]
    .sort((a, b) => {
      const pr = priorityRank(b.priority) - priorityRank(a.priority);
      if (pr !== 0) return pr;
      return b.created_at - a.created_at;
    })
    .slice(0, TOP_N);

  const empty = projectRows.length === 0 && topByPriority.length === 0;

  return (
    <div className="border border-border rounded-md bg-card/60 px-3 py-2">
      <SectionHeader
        title="OPEN ISSUES"
        meta={
          <Pill tone={openTasks.length > 0 ? "warn" : "muted"}>
            {openTasks.length}
          </Pill>
        }
      />
      {empty ? (
        <div className="text-xs text-muted-foreground mt-1">
          No open issues.
        </div>
      ) : (
        <>
          {projectRows.length > 0 && (
            <ul className="space-y-0.5 mt-1">
              {projectRows.map((row) => (
                <li key={row.slug}>
                  <Link
                    href={`/projects/${encodeURIComponent(row.slug)}/board`}
                    className="flex items-center gap-2 font-mono text-xs hover:bg-muted/30 rounded px-1 py-0.5"
                  >
                    <span className="text-[var(--azure)] shrink-0">◆</span>
                    <span className="truncate flex-1">{row.project.name}</span>
                    <span className="text-muted-foreground shrink-0">
                      {row.count}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {topByPriority.length > 0 && (
            <div className="mt-2">
              <div className="mono-label text-muted-foreground">
                TOP BY PRIORITY
              </div>
              <ul className="space-y-0.5 mt-1">
                {topByPriority.map((t) => (
                  <li key={t.id}>
                    <Link
                      href={taskHref(t)}
                      className="flex items-center gap-2 font-mono text-xs hover:bg-muted/30 rounded px-1 py-0.5"
                    >
                      <PriorityBadge priority={t.priority} />
                      <span className="truncate flex-1">{displayTitle(t)}</span>
                      {t.project_slug && (
                        <span className="text-[var(--azure)] shrink-0">
                          ◆ {t.project_slug}
                        </span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function PriorityBadge({ priority }: { priority: TaskPriority | null }) {
  if (!priority) return <Pill tone="muted">—</Pill>;
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
