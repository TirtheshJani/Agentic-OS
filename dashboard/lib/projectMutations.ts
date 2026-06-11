// dashboard/lib/projectMutations.ts
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function readGitOriginUrl(folderPath: string): string | null {
  const gitConfig = path.join(folderPath, ".git", "config");
  if (!fs.existsSync(gitConfig)) return null;
  const txt = fs.readFileSync(gitConfig, "utf8");
  const match = txt.match(/\[remote "origin"\][\s\S]*?url\s*=\s*(.+)/);
  return match ? match[1].trim() : null;
}

interface CreateFromFolderOpts {
  name: string;
  folderPath: string;
  vaultProjectsDir: string;
  capabilities?: string[];
  slug?: string;
  description?: string;
  runtimeDefault?: string;
}

interface CreateResult {
  slug: string;
  projectFilePath: string;
}

export function createProjectFromExistingFolder(opts: CreateFromFolderOpts): CreateResult {
  if (!fs.existsSync(opts.folderPath)) {
    throw new Error(`Folder does not exist: ${opts.folderPath}`);
  }
  if (!fs.statSync(opts.folderPath).isDirectory()) {
    throw new Error(`Not a directory: ${opts.folderPath}`);
  }

  const slug = opts.slug ?? slugify(opts.name);
  const projectDir = path.join(opts.vaultProjectsDir, slug);
  const projectFile = path.join(projectDir, "PROJECT.md");

  if (fs.existsSync(projectFile)) {
    throw new Error(`Project already exists at ${projectFile}`);
  }

  const repoUrl = readGitOriginUrl(opts.folderPath);
  const frontmatter: Record<string, unknown> = {
    name: opts.name,
    slug,
    path: opts.folderPath,
    crew: [],
    "runtime-default": opts.runtimeDefault ?? "claude-code",
    capabilities: opts.capabilities ?? [],
    created: new Date().toISOString().slice(0, 10),
  };
  if (repoUrl) frontmatter.repo = repoUrl;
  if (opts.description?.trim()) frontmatter.description = opts.description.trim();

  const body = `# ${opts.name}\n\nProject notes go here. The dashboard does not render this body.\n`;
  const content = matter.stringify(body, frontmatter);

  fs.mkdirSync(projectDir, { recursive: true });
  fs.writeFileSync(projectFile, content);

  return { slug, projectFilePath: projectFile };
}

export function updateProjectCrew(projectFilePath: string, crew: string[]): void {
  const raw = fs.readFileSync(projectFilePath, "utf8");
  const parsed = matter(raw);
  const data: Record<string, unknown> = { ...parsed.data, crew };
  fs.writeFileSync(projectFilePath, matter.stringify(parsed.content, data));
}

export function updateProjectFields(
  projectFilePath: string,
  patch: Partial<{ name: string; capabilities: string[]; "runtime-default": string }>
): void {
  const raw = fs.readFileSync(projectFilePath, "utf8");
  const parsed = matter(raw);
  const data: Record<string, unknown> = { ...parsed.data, ...patch };
  fs.writeFileSync(projectFilePath, matter.stringify(parsed.content, data));
}

import { spawnSync } from "node:child_process";

export function extractRepoNameFromUrl(url: string): string | null {
  // Handles https://github.com/foo/bar(.git) and git@github.com:foo/bar(.git).
  // Requires an owner/repo pair so plain hostnames like "https://example.com"
  // return null.
  const match = url.match(/[/:][^/:]+\/([^/:]+?)(?:\.git)?\/?$/);
  return match ? match[1] : null;
}

interface CloneOpts {
  name: string;
  repoUrl: string;
  workspaceRoot: string;
  vaultProjectsDir: string;
  slug?: string;
  capabilities?: string[];
}

export function cloneAndCreateProject(opts: CloneOpts): CreateResult {
  if (!fs.existsSync(opts.workspaceRoot)) {
    fs.mkdirSync(opts.workspaceRoot, { recursive: true });
  }

  const slug = opts.slug ?? slugify(opts.name);
  const targetDir = path.join(opts.workspaceRoot, slug);

  if (fs.existsSync(targetDir)) {
    throw new Error(`Target directory already exists: ${targetDir}`);
  }

  // Prefer gh if available; fall back to git.
  const useGh = spawnSync("gh", ["--version"], { stdio: "ignore" }).status === 0;
  const cmd = useGh ? "gh" : "git";
  const args = useGh
    ? ["repo", "clone", opts.repoUrl, targetDir]
    : ["clone", opts.repoUrl, targetDir];

  const result = spawnSync(cmd, args, { stdio: "pipe", encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`Clone failed (${cmd} exit ${result.status}): ${result.stderr || result.stdout}`);
  }

  return createProjectFromExistingFolder({
    name: opts.name,
    folderPath: targetDir,
    vaultProjectsDir: opts.vaultProjectsDir,
    slug,
    capabilities: opts.capabilities,
  });
}
