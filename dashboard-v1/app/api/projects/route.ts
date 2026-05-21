import { loadProjects } from "@/lib/projects-loader";

export const dynamic = "force-dynamic";

export function GET() {
  const projects = loadProjects();
  return Response.json({ projects });
}
