import { loadSkills } from "@/lib/skills-loader";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ skills: loadSkills() });
}
