import { NextResponse } from "next/server";
import { listSkills } from "@/lib/skills";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ skills: listSkills() });
}
