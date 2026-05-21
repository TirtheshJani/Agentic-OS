import { recentRuns, recentRunsByProject } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const project = url.searchParams.get("project");
  if (project) {
    return Response.json({ runs: recentRunsByProject(project, 10) });
  }
  return Response.json({ runs: recentRuns(8) });
}
