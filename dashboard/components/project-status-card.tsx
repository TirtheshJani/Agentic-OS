import { execSync } from "node:child_process";
import path from "node:path";
import {
  recentVaultChangesByPathPrefix,
  type TaskRow,
  type TaskStatus,
} from "@/lib/db";
import { repoRoot, vaultPath } from "@/lib/paths";
import { projectBySlug } from "@/lib/projects-loader";
import { listTasks } from "@/lib/tasks";
import { Pill } from "@/components/ui/pill";
import { SectionHeader } from "@/components/ui/section-header";

// Statuses we treat as "open" on the home project-status card. Matches the
// kanban board's open columns (phase 8.2 added backlog + review).
const OPEN_STATUSES: TaskStatus[] = [
  "backlog",
  "queued",
  "claimed",
  "running",
  "review",
];

// Cache the last-commit lookup for 60s, keyed by absolute project path. The
// home renders on every navigation so we keep this map at module scope; the
// dashboard is single-process so a Map is enough (no need for a real LRU).
const COMMIT_CACHE = new Map<string, { iso: string | null; ts: number }>();
const COMMIT_TTL_MS = 60 * 1000;

type Props = {
  slug: string;
};

export function ProjectStatusCard({ slug }: Props) {
  const project = projectBySlug(slug);
  if (!project) return null;

  const openTasks = listTasks({
    projectSlug: slug,
    status: OPEN_STATUSES,
    limit: 500,
  });
  const counts = countByStatus(openTasks);

  const vaultProjectPrefix = path.join(vaultPath, "projects", slug);
  const lastVaultWrite =
    recentVaultChangesByPathPrefix([vaultProjectPrefix, project.path], 1)[0] ??
    null;

  const lastCommitIso = readLastCommit(project.path, project.pathExists);

  const hasOpen = OPEN_STATUSES.some((s) => (counts[s] ?? 0) > 0);

  return (
    <div className="border border-border rounded-md bg-card/60 px-3 py-2">
      <SectionHeader
        title="PROJECT STATUS"
        meta={
          <span className="font-mono text-xs text-foreground truncate max-w-[140px]">
            {project.name}
          </span>
        }
      />

      <div className="mt-1 flex flex-wrap items-center gap-1.5 font-mono text-xs">
        {hasOpen ? (
          OPEN_STATUSES.filter((s) => (counts[s] ?? 0) > 0).map((s) => (
            <Pill key={s} tone={toneFor(s)}>
              {s}: {counts[s]}
            </Pill>
          ))
        ) : (
          <span className="text-muted-foreground">No open tasks.</span>
        )}
      </div>

      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-xs font-mono">
        <dt className="text-muted-foreground">vault</dt>
        <dd className="truncate">
          {lastVaultWrite ? (
            <span title={relPath(lastVaultWrite.path)}>
              <span className="truncate">{relPath(lastVaultWrite.path)}</span>
              <span className="text-muted-foreground">
                {" "}
                · {relativeTime(lastVaultWrite.ts)}
              </span>
            </span>
          ) : (
            <span className="text-muted-foreground">No vault writes yet.</span>
          )}
        </dd>
        <dt className="text-muted-foreground">commit</dt>
        <dd>
          {lastCommitIso ? (
            <span className="text-muted-foreground">
              {relativeTime(Date.parse(lastCommitIso))}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </dd>
      </dl>
    </div>
  );
}

function countByStatus(tasks: TaskRow[]): Partial<Record<TaskStatus, number>> {
  const out: Partial<Record<TaskStatus, number>> = {};
  for (const t of tasks) {
    out[t.status] = (out[t.status] ?? 0) + 1;
  }
  return out;
}

function toneFor(s: TaskStatus): "default" | "muted" | "good" | "warn" | "bad" {
  switch (s) {
    case "running":
      return "good";
    case "review":
      return "warn";
    case "backlog":
      return "muted";
    case "queued":
    case "claimed":
      return "default";
    default:
      return "default";
  }
}

// Returns ISO timestamp of last commit touching `absPath`, or null. Cached
// for COMMIT_TTL_MS keyed by absolute path. Failure (not a repo, path gone,
// git missing, timeout) caches null so we do not retry every render.
function readLastCommit(absPath: string, pathExists: boolean): string | null {
  if (!pathExists) return null;
  const now = Date.now();
  const cached = COMMIT_CACHE.get(absPath);
  if (cached && now - cached.ts < COMMIT_TTL_MS) return cached.iso;
  let iso: string | null = null;
  try {
    const out = execSync(
      `git log -1 --format=%cI -- "${absPath.replace(/"/g, '\\"')}"`,
      {
        cwd: absPath,
        timeout: 5000,
        stdio: ["ignore", "pipe", "ignore"],
        encoding: "utf8",
      }
    ).trim();
    iso = out.length > 0 ? out : null;
  } catch {
    iso = null;
  }
  COMMIT_CACHE.set(absPath, { iso, ts: now });
  return iso;
}

// Path display: vault paths show as `vault/...`, repo-root paths show as
// repo-relative POSIX, anything else falls back to the absolute path.
function relPath(p: string): string {
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

function relativeTime(tsMs: number): string {
  if (!Number.isFinite(tsMs)) return "—";
  const diff = Date.now() - tsMs;
  if (diff < 0) return "just now";
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 48) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  const mo = Math.floor(day / 30);
  if (mo < 12) return `${mo}mo ago`;
  const yr = Math.floor(day / 365);
  return `${yr}y ago`;
}
