import Link from "next/link";
import { openDb, getDb } from "@/lib/db";
import { listIssues } from "@/lib/issues";
import { ensureServerBooted } from "@/lib/server-init";
import { EmptyState } from "@/components/common/EmptyState";

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

  const empty = digests.length === 0 && failedRuns.length === 0 && reviewIssues.length === 0;

  return (
    <main className="max-w-5xl mx-auto p-6">
      <h1 className="text-xl font-semibold mb-6">Inbox</h1>

      {empty && (
        <EmptyState
          title="Nothing needs you"
          description="Triage digests, failed runs, and issues awaiting review will collect here."
        />
      )}

      {reviewIssues.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">
            Awaiting review ({reviewIssues.length})
          </h2>
          <ul className="space-y-2">
            {reviewIssues.map((i) => (
              <li key={i.id} className="rounded-md border border-gray-200 dark:border-gray-800 p-3 text-sm flex items-center justify-between gap-2">
                <span>
                  <span className="font-medium">{i.title}</span>
                  <span className="text-xs text-gray-400 ml-2">{i.projectSlug} · {i.assigneeSlug ?? "unassigned"}</span>
                </span>
                <Link href="/issues" className="text-xs text-blue-600 hover:underline shrink-0">board →</Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {failedRuns.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">
            Failed runs, last 7 days ({failedRuns.length})
          </h2>
          <ul className="space-y-2">
            {failedRuns.map((r) => (
              <li key={r.id} className="rounded-md border border-red-200 dark:border-red-900/50 p-3 text-sm">
                <span className="font-medium">{r.title}</span>
                <span className="text-xs text-gray-400 ml-2">
                  run #{r.id} · {r.project_slug} · {new Date(r.ended_at).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {digests.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">
            Recent captures and digests
          </h2>
          <ul className="space-y-2">
            {digests.map((d) => (
              <li key={d.path} className="rounded-md border border-gray-200 dark:border-gray-800 p-3 text-sm flex items-center justify-between gap-2">
                <span>
                  <span className="font-medium">{d.title}</span>
                  <span className="text-xs text-gray-400 ml-2 font-mono">{d.path}</span>
                </span>
                <a
                  href={`obsidian://open?vault=vault&file=${encodeURIComponent(d.path)}`}
                  className="text-xs text-purple-600 hover:underline shrink-0"
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
