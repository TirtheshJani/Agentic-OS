import Link from "next/link";
import { openDb, getDb } from "@/lib/db";
import { listIssues } from "@/lib/issues";
import { ensureServerBooted } from "@/lib/server-init";
import { EmptyState } from "@/components/common/EmptyState";
import { SectionHeader } from "@/components/common/SectionHeader";
import { Pill } from "@/components/common/Pill";
import { StatusDot } from "@/components/common/StatusDot";

export const dynamic = "force-dynamic";

interface DigestRow {
  path: string;
  title: string;
  mtime: number;
}

interface FailedRunRow {
  id: number;
  issue_id: number;
  ended_at: number;
  title: string;
  project_slug: string;
}

export default async function InboxPage() {
  await ensureServerBooted();
  openDb();
  const db = getDb();

  // Vault-backed inbox (ADR-011): triage digests written by skills land in
  // raw/daily; surface them instead of querying Gmail live from the server.
  const digests = db
    .prepare("SELECT path, title, mtime FROM notes WHERE path LIKE 'raw/%' ORDER BY mtime DESC LIMIT 15")
    .all() as DigestRow[];

  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const failedRuns = db
    .prepare(
      `SELECT r.id, r.issue_id, r.ended_at, i.title, i.project_slug
       FROM runs r JOIN issues i ON i.id = r.issue_id
       WHERE r.exit_status = 'failed' AND r.ended_at > ?
       ORDER BY r.ended_at DESC LIMIT 20`
    )
    .all(weekAgo) as FailedRunRow[];

  const reviewIssues = listIssues({ status: "review" });

  // ADR-020: issues whose latest run was interrupted by a restart land in
  // review. Flag them so the operator can tell a finished-for-review issue from
  // one that needs resume/requeue/discard.
  const interruptedIds = new Set(
    (
      db
        .prepare(
          `SELECT i.id AS id FROM issues i
           JOIN runs r ON r.id = (
             SELECT id FROM runs WHERE issue_id = i.id ORDER BY started_at DESC LIMIT 1
           )
           WHERE i.status = 'review' AND r.exit_status = 'interrupted'`
        )
        .all() as { id: number }[]
    ).map((r) => r.id)
  );

  const empty = digests.length === 0 && failedRuns.length === 0 && reviewIssues.length === 0;

  return (
    <main className="max-w-5xl mx-auto p-6">
      <SectionHeader kicker="TRIAGE" title="Inbox" />

      {empty && (
        <EmptyState
          title="Nothing needs you"
          description="Triage digests, failed runs, and issues awaiting review will collect here."
        />
      )}

      {reviewIssues.length > 0 && (
        <section className="mb-8">
          <h2 className="font-label uppercase tracking-wide text-[10px] text-ink3 mb-3">
            Awaiting review ({reviewIssues.length})
          </h2>
          <ul className="space-y-2">
            {reviewIssues.map((i) => (
              <li
                key={i.id}
                className="rounded-card border border-line bg-surface p-3 text-sm flex items-center justify-between gap-2 transition-colors hover:border-accent-line"
              >
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-ink">{i.title}</span>
                  {interruptedIds.has(i.id) && <Pill tone="warn">interrupted</Pill>}
                  <span className="text-xs text-ink3">
                    {i.projectSlug} · {i.assigneeSlug ?? "unassigned"}
                  </span>
                </span>
                <Link
                  href="/issues"
                  className="shrink-0 rounded-pill border border-line2 bg-surface px-3 py-1 text-xs text-ink2 transition-colors hover:border-accent-line hover:text-accent-ink"
                >
                  board →
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {failedRuns.length > 0 && (
        <section className="mb-8">
          <h2 className="font-label uppercase tracking-wide text-[10px] text-ink3 mb-3">
            Failed runs, last 7 days ({failedRuns.length})
          </h2>
          <ul className="space-y-2">
            {failedRuns.map((r) => (
              <li
                key={r.id}
                className="rounded-card border border-danger-bg bg-surface p-3 text-sm flex flex-wrap items-center gap-2"
              >
                <StatusDot tone="danger" />
                <span className="font-medium text-ink">{r.title}</span>
                <span className="text-xs text-ink3">
                  <span className="font-mono">run #{r.id}</span> · {r.project_slug} ·{" "}
                  {new Date(r.ended_at).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {digests.length > 0 && (
        <section className="mb-8">
          <h2 className="font-label uppercase tracking-wide text-[10px] text-ink3 mb-3">
            Recent captures and digests
          </h2>
          <ul className="space-y-2">
            {digests.map((d) => (
              <li
                key={d.path}
                className="rounded-card border border-line bg-surface p-3 text-sm flex items-center justify-between gap-2 transition-colors hover:border-accent-line"
              >
                <span className="min-w-0 flex flex-wrap items-center gap-2">
                  <span className="font-medium text-ink">{d.title}</span>
                  <span className="text-xs text-ink3 font-mono truncate">{d.path}</span>
                </span>
                <a
                  href={`obsidian://open?vault=vault&file=${encodeURIComponent(d.path)}`}
                  className="shrink-0 rounded-pill border border-line2 bg-surface px-3 py-1 text-xs text-ink2 transition-colors hover:border-accent-line hover:text-accent-ink"
                >
                  Obsidian →
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
