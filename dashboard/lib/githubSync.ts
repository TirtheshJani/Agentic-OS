import { listGitHubIssues } from "@/lib/github";
import {
  createIssue,
  updateIssue,
  getIssueByGitHubNumber,
  type IssueStatus,
} from "@/lib/issues";

export interface ImportResult {
  imported: number;
  updated: number;
  skipped: number;
  error?: string;
}

/**
 * Inbound GitHub -> dashboard import (spec 0029 / roadmap phase 8.5).
 *
 * Pulls a repo's issues via the `gh` CLI and upserts them into the local board,
 * keyed on (projectSlug, github_number). New remote issues are created; existing
 * local rows refresh only title/body/labels/githubUrl and keep their local
 * agent, status, and priority. This is why the import does not loop with the
 * outbound mirror (createGitHubIssue): a mirrored local issue already carries
 * its github_number, so re-importing matches and updates it rather than making a
 * duplicate, and the import never touches a local row's status.
 *
 * Read-only by direction: this function never writes back to GitHub. Write-back
 * (closing an issue) is a separate, per-project opt-in handled at the API edge.
 */
export function importIssues(projectSlug: string, repo: string, limit = 200): ImportResult {
  const remote = listGitHubIssues(repo, limit);
  if (remote === null) {
    return { imported: 0, updated: 0, skipped: 0, error: "gh issue list failed (auth, network, or repo)" };
  }

  let imported = 0;
  let updated = 0;
  let skipped = 0;

  for (const r of remote) {
    if (!r.number) {
      skipped++;
      continue;
    }
    const labels = (r.labels ?? []).map((l) => l.name);
    const existing = getIssueByGitHubNumber(projectSlug, r.number);
    if (existing) {
      // Refresh remote-owned fields only; never clobber local status/agent.
      updateIssue(existing.id, {
        title: r.title,
        body: r.body ?? "",
        labels,
        githubUrl: r.url,
      });
      updated++;
    } else {
      const status: IssueStatus = r.state?.toUpperCase() === "CLOSED" ? "done" : "backlog";
      createIssue({
        projectSlug,
        title: r.title,
        body: r.body ?? "",
        status,
        labels,
        githubUrl: r.url,
        githubNumber: r.number,
      });
      imported++;
    }
  }

  return { imported, updated, skipped };
}
