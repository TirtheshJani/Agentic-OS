import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { branchFor, type BranchMeta } from "./branches";
import { skillsPath } from "./paths";

export type SkillFrontmatter = {
  name: string;
  description: string;
  license?: string;
  "allowed-tools"?: string;
  metadata?: Record<string, unknown>;
};

export type Skill = {
  name: string;
  description: string;
  folder: string;
  status: "stub" | "authored";
  domain: string;
  branch: BranchMeta;
  cadence?: "M" | "L" | "R" | "A";
  mode?: string;
  mcpServer?: string;
  externalApis?: string[];
  outputs?: string[];
  isMeta: boolean;
};

function walkSkillMd(dir: string, acc: string[] = []): string[] {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walkSkillMd(full, acc);
    else if (e.isFile() && e.name === "SKILL.md") acc.push(full);
  }
  return acc;
}

export function loadSkills(): Skill[] {
  const files = walkSkillMd(skillsPath);
  const skills: Skill[] = [];
  for (const file of files) {
    const raw = fs.readFileSync(file, "utf8");
    const parsed = matter(raw);
    const fm = parsed.data as SkillFrontmatter;
    if (!fm.name || !fm.description) continue;
    const folder = path.relative(skillsPath, path.dirname(file));
    const meta = (fm.metadata ?? {}) as Record<string, unknown>;
    const isMeta = folder.startsWith("_meta");
    const domain =
      (meta.domain as string) ??
      (isMeta ? "_meta" : folder.split(path.sep).slice(0, -1).join("/"));
    skills.push({
      name: fm.name,
      description: fm.description,
      folder,
      status: (meta.status as "stub" | "authored") ?? "authored",
      domain,
      branch: branchFor(domain || folder.split(path.sep)[0]),
      cadence: (meta.cadence as Skill["cadence"]) ?? undefined,
      mode: meta.mode as string | undefined,
      mcpServer: meta["mcp-server"] as string | undefined,
      externalApis: meta["external-apis"] as string[] | undefined,
      outputs: meta.outputs as string[] | undefined,
      isMeta,
    });
  }
  return skills.sort((a, b) => {
    const ord = a.branch.order - b.branch.order;
    return ord !== 0 ? ord : a.folder.localeCompare(b.folder);
  });
}

export function skillsByDomain(skills: Skill[]) {
  const map = new Map<string, Skill[]>();
  for (const s of skills) {
    const key = s.domain;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(s);
  }
  return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
}
