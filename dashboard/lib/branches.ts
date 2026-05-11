export type BranchFamily = "foundation" | "capability" | "project";

export type BranchMeta = {
  family: BranchFamily;
  label: string;
  order: number;
};

const BRANCH_BY_DOMAIN_ROOT: Record<string, BranchMeta> = {
  _meta: { family: "foundation", label: "META", order: 0 },
  productivity: { family: "foundation", label: "PRODUCTIVITY", order: 1 },
  business: { family: "foundation", label: "PRODUCTIVITY", order: 1 },
  "healthcare-ai": { family: "capability", label: "HEALTHCARE-AI", order: 10 },
  aiml: { family: "capability", label: "AI / ML PROJECT WORK", order: 11 },
  physics: { family: "capability", label: "PHYSICS / ASTRONOMY", order: 12 },
  research: { family: "capability", label: "RESEARCH", order: 13 },
  coding: { family: "capability", label: "CODING", order: 14 },
  content: { family: "capability", label: "CONTENT", order: 15 },
  career: { family: "capability", label: "CAREER", order: 16 },
  networking: { family: "capability", label: "NETWORKING", order: 17 },
};

const FALLBACK: BranchMeta = { family: "capability", label: "OTHER", order: 99 };

export function branchFor(domain: string): BranchMeta {
  const root = domain.split("/")[0];
  return BRANCH_BY_DOMAIN_ROOT[root] ?? FALLBACK;
}

export const FAMILY_ORDER: BranchFamily[] = ["foundation", "capability", "project"];

export const FAMILY_LABEL: Record<BranchFamily, string> = {
  foundation: "FOUNDATIONS · always on",
  capability: "CAPABILITIES · modular",
  project: "PROJECTS · long-running",
};
