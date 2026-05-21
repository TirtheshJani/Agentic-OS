import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { parseProjectFrontmatter, ProjectFrontmatter } from "@/lib/schemas";
import { VAULT_PROJECTS_DIR } from "@/lib/paths";

export interface Project extends ProjectFrontmatter {
  filePath: string;
  bodyMarkdown: string;
  lastModified: number;
}

export function parseProjectFile(filePath: string): Project {
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = matter(raw);
  const fm = parseProjectFrontmatter(parsed.data);
  const stat = fs.statSync(filePath);
  return {
    ...fm,
    filePath,
    bodyMarkdown: parsed.content.trim(),
    lastModified: stat.mtimeMs,
  };
}

export function listProjects(rootDir: string = VAULT_PROJECTS_DIR): Project[] {
  if (!fs.existsSync(rootDir)) return [];
  const entries = fs.readdirSync(rootDir, { withFileTypes: true });
  const projects: Project[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const projectFile = path.join(rootDir, entry.name, "PROJECT.md");
    if (!fs.existsSync(projectFile)) continue;
    try {
      projects.push(parseProjectFile(projectFile));
    } catch (err) {
      console.warn(`[projects] skipping ${projectFile}: ${(err as Error).message}`);
    }
  }
  return projects.sort((a, b) => b.lastModified - a.lastModified);
}

export function getProject(slug: string, rootDir: string = VAULT_PROJECTS_DIR): Project | null {
  const projectFile = path.join(rootDir, slug, "PROJECT.md");
  if (!fs.existsSync(projectFile)) return null;
  try {
    return parseProjectFile(projectFile);
  } catch {
    return null;
  }
}
