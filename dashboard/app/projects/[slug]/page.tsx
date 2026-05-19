import Link from "next/link";
import path from "node:path";
import { notFound } from "next/navigation";
import { Header } from "@/components/header";
import { RunStateProvider } from "@/components/run-state";
import { Starfield } from "@/components/starfield";
import { Pill } from "@/components/ui/pill";
import { SectionHeader } from "@/components/ui/section-header";
import { StatusDot } from "@/components/ui/status-dot";
import {
  recentRunsByProject,
  recentVaultChangesByPathPrefix,
  type RunRow,
  type TaskRow,
  type VaultChangeRow,
} from "@/lib/db";
import { repoRoot, vaultPath } from "@/lib/paths";
import { projectBySlug, type Project, type ProjectStatus } from "@/lib/projects-loader";
import { listTasks } from "@/lib/tasks";
import { displayTitle, taskHref } from "@/lib/ui-utils";
import { PriorityBadge } from "@/components/priority-badge";

export const dynamic = "force-dynamic";

// Statuses considered "open" for the project detail page open-tasks list.
// `backlog` and `review` are added by phase 8.2; included here defensively
// so wave-2 rows surface immediately once they exist.
const OPEN_STATUSES: ReadonlySet<string> = new Set([
  "backlog",
  "queued",
  "claimed",
  "running",
  "review",
]);

const STATUS_TONE: Record<ProjectStatus, "good" | "muted" | "warn"> = {
  active: "good",
  dormant: "warn",
  archived: "muted",
};

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const project = projectBySlug(slug);
  if (!project) notFound();

  const openTasks = listTasks({ projectSlug: slug, limit: 20 }).filter((t) =>
    OPEN_STATUSES.has(t.status)
  );
  const runs = recentRunsByProject(slug, 10);
  const vaultProjectPrefix = path.join(vaultPath, "projects", slug);
  const vaultWrites = recentVaultChangesByPathPrefix(
    [vaultProjectPrefix, project.path],
    10
  );

  return (
    <RunStateProvider>
      <Starfield />
      <Header />
      <main className="max-w-4xl mx-auto p-4 space-y-4">
        <ProjectHeader project={project} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <OpenTasksCard tasks={openTasks} />
          <RecentRunsCard runs={runs} />
        </div>
        <VaultWritesCard changes={vaultWrites} />
      </main>
    </RunStateProvider>
  );
}

function ProjectHeader({ project }: { project: Project }) {
  return (
    <section className="border border-border rounded-md bg-card/60 px-4 py-3 space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-xl font-semibold">{project.name}</h1>
        <Pill tone={STATUS_TONE[project.status]} glyph="·">
          {project.status.toUpperCase()}
        </Pill>
        <Link
          href={`/?project=${encodeURIComponent(project.slug)}`}
          className="ml-auto mono-label px-2 py-1 border border-border rounded-sm hover:bg-muted/40"
        >
          ◆ RUN IN THIS PROJECT
        </Link>
      </div>
      <p className="text-sm text-muted-foreground">{project.description}</p>
      {project.capabilities.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {project.capabilities.map((cap) => (
            <Pill key={cap} tone="default">
              {cap}
            </Pill>
          ))}
        </div>
      )}
      <dl className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs font-mono">
        <dt className="text-muted-foreground">repo</dt>
        <dd>
          {project.repoUrl ? (
            <a
              href={project.repoUrl}
              target="_blank"
              rel="noreferrer"
              className="text-[var(--azure)] hover:underline break-all"
            >
              {project.repoUrl} ↗
            </a>
          ) : (
            <span className="text-muted-foreground">none</span>
          )}
        </dd>
        <dt className="text-muted-foreground">path</dt>
        <dd className="flex items-center gap-2 flex-wrap">
          <span className="break-all">{project.path}</span>
          {!project.pathExists && <Pill tone="bad">MISSING</Pill>}
        </dd>
        <dt className="text-muted-foreground">branch</dt>
        <dd>{project.branch}</dd>
        {project.agent && (
          <>
            <dt className="text-muted-foreground">agent</dt>
            <dd>{project.agent}</dd>
          </>
        )}
      </dl>
    </section>
  );
}

function OpenTasksCard({ tasks }: { tasks: TaskRow[] }) {
  return (
    <section className="border border-border rounded-md bg-card/60 px-3 py-2">
      <SectionHeader title="OPEN TASKS" meta={`${tasks.length}`} />
      {tasks.length === 0 ? (
        <div className="text-xs text-muted-foreground py-1">No open tasks.</div>
      ) : (
        <ul className="space-y-1 mt-1">
          {tasks.map((t) => (
            <li key={t.id} className="font-mono text-xs">
              <Link
                href={taskHref(t)}
                className="flex items-baseline gap-2 hover:bg-muted/30 rounded px-1 py-0.5"
              >
                <span className="text-muted-foreground shrink-0">#{t.id}</span>
                <span className="truncate flex-1">{displayTitle(t, 80)}</span>
                {t.priority && <PriorityBadge priority={t.priority} />}
                <span className="text-muted-foreground shrink-0">{t.assignee}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function RecentRunsCard({ runs }: { runs: RunRow[] }) {
  return (
    <section className="border border-border rounded-md bg-card/60 px-3 py-2">
      <SectionHeader title="RECENT RUNS" meta={`${runs.length}`} />
      {runs.length === 0 ? (
        <div className="text-xs text-muted-foreground py-1">No runs yet.</div>
      ) : (
        <ul className="space-y-1 mt-1">
          {runs.map((r) => (
            <li key={r.id} className="font-mono text-xs">
              <Link
                href={r.task_id ? `/tasks/${r.task_id}` : "#"}
                className="flex items-center gap-2 hover:bg-muted/30 rounded px-1 py-0.5"
              >
                <StatusDot state={dotFor(r.status)} />
                <span className="text-muted-foreground shrink-0">
                  {hhmm(r.started_at)}
                </span>
                <span className="truncate flex-1">{r.skill_slug}</span>
                <span className="text-muted-foreground shrink-0">
                  {formatDuration(r.duration_ms)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function VaultWritesCard({ changes }: { changes: VaultChangeRow[] }) {
  return (
    <section className="border border-border rounded-md bg-card/60 px-3 py-2">
      <SectionHeader title="RECENT VAULT WRITES" meta={`${changes.length}`} />
      {changes.length === 0 ? (
        <div className="text-xs text-muted-foreground py-1">
          No recent vault writes.
        </div>
      ) : (
        <ul className="space-y-1 mt-1">
          {changes.map((c) => (
            <li
              key={c.id}
              className="flex items-baseline gap-2 font-mono text-xs"
            >
              <span className="text-muted-foreground shrink-0">{hhmm(c.ts)}</span>
              <span className="text-muted-foreground shrink-0 w-12">{c.kind}</span>
              <span className="truncate flex-1">{relPath(c.path)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function dotFor(s: RunRow["status"]): "idle" | "running" | "blocked" {
  if (s === "running") return "running";
  if (s === "error") return "blocked";
  return "idle";
}

function hhmm(ts: number): string {
  const d = new Date(ts);
  const h = `${d.getHours()}`.padStart(2, "0");
  const m = `${d.getMinutes()}`.padStart(2, "0");
  return `${h}:${m}`;
}

function formatDuration(ms: number | null): string {
  if (ms === null) return "—";
  if (ms >= 60_000) return `${(ms / 60_000).toFixed(1)}m`;
  if (ms >= 1_000) return `${(ms / 1_000).toFixed(1)}s`;
  return `${ms}ms`;
}

function relPath(p: string): string {
  // Display vault paths as `vault/...` and repo paths as repo-relative when
  // possible; fall back to the absolute path otherwise.
  const candidates = [
    { root: vaultPath, label: "vault" },
    { root: repoRoot, label: "" },
  ];
  for (const { root, label } of candidates) {
    const rel = path.relative(root, p);
    if (!rel.startsWith("..") && !path.isAbsolute(rel)) {
      const norm = rel.split(path.sep).join("/");
      return label ? `${label}/${norm}` : norm;
    }
  }
  return p;
}
