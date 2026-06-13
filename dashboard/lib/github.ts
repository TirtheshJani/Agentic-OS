import { spawnSync } from "node:child_process";

export interface GitHubIssue {
  url: string;
  number: number;
}

export function createGitHubIssue(repo: string, title: string, body: string): GitHubIssue | null {
  // repo should be a URL like https://github.com/owner/repo
  // gh issue create --repo <repo> --title <title> --body <body>
  
  console.log(`[github] creating issue in ${repo}: ${title}`);
  
  const r = spawnSync("gh", ["issue", "create", "--repo", repo, "--title", title, "--body", body], {
    encoding: "utf8",
    shell: process.platform === "win32",
    timeout: 30_000,
  });

  if (r.status !== 0) {
    console.error(`[github] gh issue create failed: ${r.stderr}`);
    return null;
  }

  const url = r.stdout.trim();
  if (!url.startsWith("https://github.com/")) {
    console.error(`[github] unexpected output from gh issue create: ${url}`);
    return null;
  }

  const match = url.match(/\/issues\/(\d+)$/);
  const number = match ? parseInt(match[1], 10) : 0;

  return { url, number };
}

export function isGitHubRepo(repoUrl?: string): boolean {
  return !!repoUrl && (repoUrl.startsWith("https://github.com/") || repoUrl.startsWith("git@github.com:"));
}

/** A GitHub issue as returned by `gh issue list --json`. */
export interface RemoteIssue {
  number: number;
  title: string;
  body: string;
  state: string; // "OPEN" | "CLOSED"
  url: string;
  labels: { name: string }[];
}

/**
 * List issues from a GitHub repo via the operator's authenticated `gh` CLI.
 * Returns null on any failure (auth, network, bad repo) so callers can degrade
 * cleanly. `limit` caps the pull; pull-on-demand only, no webhook daemon.
 */
export function listGitHubIssues(repo: string, limit = 200): RemoteIssue[] | null {
  console.log(`[github] importing issues from ${repo} (limit ${limit})`);
  const r = spawnSync(
    "gh",
    [
      "issue",
      "list",
      "--repo",
      repo,
      "--state",
      "all",
      "--limit",
      String(limit),
      "--json",
      "number,title,body,state,url,labels",
    ],
    { encoding: "utf8", shell: process.platform === "win32", timeout: 60_000 }
  );
  if (r.status !== 0) {
    console.error(`[github] gh issue list failed: ${r.stderr}`);
    return null;
  }
  try {
    const parsed = JSON.parse(r.stdout) as RemoteIssue[];
    return Array.isArray(parsed) ? parsed : null;
  } catch (err) {
    console.error(`[github] could not parse gh issue list output: ${(err as Error).message}`);
    return null;
  }
}

/** Close a GitHub issue. Returns true on success. Used by opt-in write-back. */
export function closeGitHubIssue(repo: string, number: number): boolean {
  const r = spawnSync("gh", ["issue", "close", String(number), "--repo", repo], {
    encoding: "utf8",
    shell: process.platform === "win32",
    timeout: 30_000,
  });
  if (r.status !== 0) {
    console.error(`[github] gh issue close #${number} failed: ${r.stderr}`);
    return false;
  }
  return true;
}
