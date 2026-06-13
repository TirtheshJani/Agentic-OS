import { NextResponse } from "next/server";
import { z } from "zod";
import { openDb } from "@/lib/db";
import { createEpic, listEpics, rollupStatus, childIssues, eligibleChildren, type Epic } from "@/lib/epics";

openDb(); // initializes the singleton if not already

/** A child issue as surfaced to the epics view: dependency-ordered, eligibility flagged. */
export interface EpicChildView {
  id: number;
  title: string;
  status: string;
  dependsOn: number[];
  eligible: boolean;
}

/** An epic plus its derived rollup and dependency-ordered children. */
export interface EpicView extends Epic {
  rollup: "empty" | "in-progress" | "done";
  children: EpicChildView[];
}

/**
 * Pure view assembler (no Request, no NextResponse) so it is trivially testable.
 * For each epic it computes the rollup status and lists children in dependency
 * order: eligible (independent / deps met) first, then ineligible (blocked),
 * each preserving creation order. Eligibility reuses lib/epics.eligibleChildren.
 */
export function assembleEpicsView(projectSlug?: string): EpicView[] {
  const epics = listEpics(projectSlug ? { projectSlug } : {});
  return epics.map((epic) => {
    const children = childIssues(epic.id);
    const eligibleIds = new Set(eligibleChildren(epic.id).map((c) => c.id));
    const view: EpicChildView[] = children.map((c) => ({
      id: c.id,
      title: c.title,
      status: c.status,
      dependsOn: c.dependsOn,
      eligible: eligibleIds.has(c.id),
    }));
    // Eligible (unblocked) children first, blocked last; stable within each group.
    view.sort((a, b) => Number(b.eligible) - Number(a.eligible));
    return { ...epic, rollup: rollupStatus(epic.id), children: view };
  });
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const projectSlug = searchParams.get("projectSlug") ?? undefined;
  return NextResponse.json({ epics: assembleEpicsView(projectSlug) });
}

const CreateSchema = z.object({
  projectSlug: z.string().min(1),
  title: z.string().min(1),
  why: z.string().optional(),
  sharedContract: z.string().optional(),
  milestone: z.string().nullable().optional(),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid request", issues: parsed.error.issues }, { status: 400 });
  }
  const id = createEpic(parsed.data);
  return NextResponse.json({ id }, { status: 201 });
}
