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
