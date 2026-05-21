import { loadIssues } from "@/lib/design/loaders";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const projectRaw = url.searchParams.get("project");
    const assigneeRaw = url.searchParams.get("assignee");
    const project = projectRaw && projectRaw !== "" ? projectRaw : null;
    const assignee = assigneeRaw && assigneeRaw !== "" ? assigneeRaw : null;
    const issues = await loadIssues({ project, assignee });
    return Response.json(issues);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return Response.json({ error: message }, { status: 500 });
  }
}
