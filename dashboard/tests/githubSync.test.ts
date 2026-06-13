import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { openDb, closeDb } from "@/lib/db";
import { createIssue, getIssue, listIssues } from "@/lib/issues";
import type { RemoteIssue } from "@/lib/github";

// Mock the gh CLI wrapper so the sync logic is tested without a network call.
const listGitHubIssues = vi.fn<(repo: string, limit?: number) => RemoteIssue[] | null>();
vi.mock("@/lib/github", () => ({
  listGitHubIssues: (repo: string, limit?: number) => listGitHubIssues(repo, limit),
  isGitHubRepo: (u?: string) => !!u && u.startsWith("https://github.com/"),
}));

// Import after the mock is registered.
const { importIssues } = await import("@/lib/githubSync");

let tmp: string;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "agentic-ghsync-"));
  openDb(path.join(tmp, "state.db"));
  listGitHubIssues.mockReset();
});

afterEach(() => {
  closeDb();
  fs.rmSync(tmp, { recursive: true, force: true });
});

const remote = (n: number, over: Partial<RemoteIssue> = {}): RemoteIssue => ({
  number: n,
  title: `Remote ${n}`,
  body: `body ${n}`,
  state: "OPEN",
  url: `https://github.com/o/r/issues/${n}`,
  labels: [{ name: "bug" }],
  ...over,
});

describe("importIssues (GitHub -> board)", () => {
  it("imports new remote issues with state-mapped status", () => {
    listGitHubIssues.mockReturnValue([remote(1), remote(2, { state: "CLOSED" })]);
    const r = importIssues("proj", "https://github.com/o/r");

    expect(r).toEqual({ imported: 2, updated: 0, skipped: 0 });
    const issues = listIssues({ projectSlug: "proj" });
    expect(issues).toHaveLength(2);
    expect(issues.find((i) => i.githubNumber === 1)!.status).toBe("backlog");
    expect(issues.find((i) => i.githubNumber === 2)!.status).toBe("done");
    expect(issues.find((i) => i.githubNumber === 1)!.labels).toEqual(["bug"]);
  });

  it("is idempotent: re-import updates, never duplicates", () => {
    listGitHubIssues.mockReturnValue([remote(1)]);
    importIssues("proj", "https://github.com/o/r");

    listGitHubIssues.mockReturnValue([remote(1, { title: "Renamed", body: "new" })]);
    const r2 = importIssues("proj", "https://github.com/o/r");

    expect(r2).toEqual({ imported: 0, updated: 1, skipped: 0 });
    const issues = listIssues({ projectSlug: "proj" });
    expect(issues).toHaveLength(1);
    expect(issues[0].title).toBe("Renamed");
    expect(issues[0].body).toBe("new");
  });

  it("refreshes remote fields but preserves local status (no echo with mirror)", () => {
    // A locally-mirrored issue already carries its github_number and a local
    // status; re-import must not reset it.
    const id = createIssue({
      projectSlug: "proj",
      title: "local",
      status: "running",
      githubNumber: 7,
      githubUrl: "https://github.com/o/r/issues/7",
    });

    listGitHubIssues.mockReturnValue([remote(7, { title: "from gh", state: "CLOSED" })]);
    const r = importIssues("proj", "https://github.com/o/r");

    expect(r).toEqual({ imported: 0, updated: 1, skipped: 0 });
    const issue = getIssue(id)!;
    expect(issue.title).toBe("from gh");
    expect(issue.status).toBe("running"); // local status untouched
    expect(listIssues({ projectSlug: "proj" })).toHaveLength(1);
  });

  it("returns an error result when gh fails", () => {
    listGitHubIssues.mockReturnValue(null);
    const r = importIssues("proj", "https://github.com/o/r");
    expect(r.error).toBeTruthy();
    expect(r.imported).toBe(0);
  });

  it("scopes idempotency per project", () => {
    listGitHubIssues.mockReturnValue([remote(1)]);
    importIssues("projA", "https://github.com/o/r");
    importIssues("projB", "https://github.com/o/r");
    expect(listIssues({ projectSlug: "projA" })).toHaveLength(1);
    expect(listIssues({ projectSlug: "projB" })).toHaveLength(1);
  });
});
