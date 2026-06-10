import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { SKILLS_DIR } from "@/lib/paths";

export interface SkillSummary {
  name: string;
  description: string;
  /** Folder path relative to the skills root, e.g. "research/paper-search". */
  folder: string;
  domain: string;
  status: string;
  mode?: string;
  mcpServer?: string;
}

function walkSkillFiles(dir: string, acc: string[] = []): string[] {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walkSkillFiles(full, acc);
    else if (e.isFile() && e.name === "SKILL.md") acc.push(full);
  }
  return acc;
}

export function listSkills(rootDir: string = SKILLS_DIR): SkillSummary[] {
  const files = walkSkillFiles(rootDir);
  const skills: SkillSummary[] = [];
  for (const file of files) {
    let parsed: matter.GrayMatterFile<string>;
    try {
      parsed = matter(fs.readFileSync(file, "utf8"));
    } catch (err) {
      console.error(`[skills] failed to parse ${file}:`, err);
      continue;
    }
    const fm = parsed.data as Record<string, unknown>;
    if (typeof fm.name !== "string" || typeof fm.description !== "string") continue;
    const folder = path.relative(rootDir, path.dirname(file)).split(path.sep).join("/");
    const meta = (fm.metadata ?? {}) as Record<string, unknown>;
    const domain = (meta.domain as string) ?? folder.split("/")[0];
    skills.push({
      name: fm.name,
      description: fm.description,
      folder,
      domain,
      status: (meta.status as string) ?? "authored",
      mode: meta.mode as string | undefined,
      mcpServer: meta["mcp-server"] as string | undefined,
    });
  }
  return skills.sort((a, b) =>
    a.domain === b.domain ? a.name.localeCompare(b.name) : a.domain.localeCompare(b.domain)
  );
}

export function skillExists(name: string, rootDir: string = SKILLS_DIR): boolean {
  return listSkills(rootDir).some((s) => s.name === name);
}
