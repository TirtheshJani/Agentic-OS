import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { repoRoot, vaultPath } from "./paths";

export type ProjectStatus = "active" | "dormant" | "archived";

export type ProjectFrontmatter = {
  name?: string;
  slug?: string;
  description?: string;
  status?: ProjectStatus;
  branch?: string;
  path?: string;
  "repo-url"?: string;
  capabilities?: string[];
  agent?: string;
};

export type Project = {
  name: string;
  slug: string;
  description: string;
  status: ProjectStatus;
  branch: string;
  path: string;
  repoUrl: string | null;
  capabilities: string[];
  agent: string | null;
  pathExists: boolean;
  projectFile: string;
};

const projectsRoot = path.join(vaultPath, "projects");

const STATUS_ORDER: Record<ProjectStatus, number> = {
  active: 0,
  dormant: 1,
  archived: 2,
};

function resolveProjectPath(rawPath: string): string {
  if (!rawPath) return repoRoot;
  if (path.isAbsolute(rawPath)) return path.resolve(rawPath);
  if (/^[a-zA-Z]:[\\/]/.test(rawPath)) return path.resolve(rawPath);
  return path.resolve(repoRoot, rawPath);
}

export function loadProjects(): Project[] {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(projectsRoot, { withFileTypes: true });
  } catch {
    return [];
  }
  const projects: Project[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const file = path.join(projectsRoot, entry.name, "PROJECT.md");
    if (!fs.existsSync(file)) continue;
    let raw: string;
    try {
      raw = fs.readFileSync(file, "utf8");
    } catch {
      continue;
    }
    const fm = matter(raw).data as ProjectFrontmatter;
    if (!fm.name || !fm.slug || !fm.description) continue;
    const resolvedPath = resolveProjectPath(fm.path ?? entry.name);
    projects.push({
      name: fm.name,
      slug: fm.slug,
      description: fm.description,
      status: fm.status ?? "active",
      branch: fm.branch ?? "other",
      path: resolvedPath,
      repoUrl: fm["repo-url"] ? String(fm["repo-url"]) : null,
      capabilities: Array.isArray(fm.capabilities) ? fm.capabilities : [],
      agent: fm.agent ?? null,
      pathExists: safeExists(resolvedPath),
      projectFile: file,
    });
  }
  return projects.sort((a, b) => {
    const s = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    return s !== 0 ? s : a.name.localeCompare(b.name);
  });
}

export function projectBySlug(slug: string): Project | null {
  return loadProjects().find((p) => p.slug === slug) ?? null;
}

function safeExists(p: string): boolean {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}
