import { NextResponse } from "next/server";
import { getProject } from "@/lib/projects";
import { listWorktrees, removeWorktree } from "@/lib/worktrees";
import { listActiveRunsForProject } from "@/lib/runs";
import { openDb } from "@/lib/db";

openDb();

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project) return NextResponse.json({ error: "project not found" }, { status: 404 });

  const all = listWorktrees(project.path);
  const activeRuns = listActiveRunsForProject(slug);
  const activeWorktreePaths = new Set(activeRuns.map(r => r.worktreePath));

  return NextResponse.json({
    worktrees: all
      .filter(w => !w.isPrimary)
      .map(w => ({
        path: w.path,
        branch: w.branch,
        head: w.head,
        isActive: activeWorktreePaths.has(w.path),
      })),
  });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project) return NextResponse.json({ error: "project not found" }, { status: 404 });

  const url = new URL(req.url);
  const worktreePath = url.searchParams.get("path");
  if (!worktreePath) return NextResponse.json({ error: "path query param required" }, { status: 400 });

  const activeRuns = listActiveRunsForProject(slug);
  if (activeRuns.some(r => r.worktreePath === worktreePath)) {
    return NextResponse.json({ error: "worktree has an active run; stop it first" }, { status: 409 });
  }

  try {
    removeWorktree({ sourceRepoPath: project.path, worktreePath, force: true });
    return new Response(null, { status: 204 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
