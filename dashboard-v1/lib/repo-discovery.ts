import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { discoveryRoot } from "./paths";

export type DiscoveredRepo = {
  name: string;
  slug: string;
  path: string;
  summary: string;
  hasGit: boolean;
  hasClaudeMd: boolean;
  localAgents: string[];
  localSkills: string[];
  source: "discovery";
};

const IGNORE_MARKER = ".agentic-os-ignore";
const SUMMARY_MAX = 220;

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function safeReadDir(dir: string): fs.Dirent[] {
  try {
    return fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}

function safeReadFile(p: string): string | null {
  try {
    return fs.readFileSync(p, "utf8");
  } catch {
    return null;
  }
}

function firstProseLine(text: string): string | null {
  const body = text.replace(/^---[\s\S]*?---\s*/m, "");
  const lines = body.split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("#")) continue;
    if (line.startsWith("<!--")) continue;
    if (line.startsWith("```")) continue;
    return line.slice(0, SUMMARY_MAX);
  }
  return null;
}

function extractSummary(repoPath: string): string {
  const claudeMd = safeReadFile(path.join(repoPath, "CLAUDE.md"));
  if (claudeMd) {
    const parsed = matter(claudeMd);
    const fm = parsed.data as Record<string, unknown>;
    if (typeof fm.description === "string" && fm.description.trim()) {
      return fm.description.trim().slice(0, SUMMARY_MAX);
    }
    const line = firstProseLine(claudeMd);
    if (line) return line;
  }

  const readme = safeReadFile(path.join(repoPath, "README.md"));
  if (readme) {
    const line = firstProseLine(readme);
    if (line) return line;
  }

  const pkgRaw = safeReadFile(path.join(repoPath, "package.json"));
  if (pkgRaw) {
    try {
      const pkg = JSON.parse(pkgRaw) as { description?: string };
      if (pkg.description?.trim()) {
        return pkg.description.trim().slice(0, SUMMARY_MAX);
      }
    } catch {
      // ignore
    }
  }

  return "(no summary)";
}

function listLocalAgents(repoPath: string): string[] {
  const candidates = [
    path.join(repoPath, ".claude", "agents"),
    path.join(repoPath, "agents"),
  ];
  const names = new Set<string>();
  for (const dir of candidates) {
    for (const entry of safeReadDir(dir)) {
      if (!entry.isFile()) continue;
      if (!entry.name.endsWith(".md")) continue;
      if (entry.name === "README.md" || entry.name === "AGENTS.md") continue;
      names.add(entry.name.replace(/\.md$/, ""));
    }
  }
  return Array.from(names).sort();
}

function listLocalSkills(repoPath: string): string[] {
  const names = new Set<string>();
  for (const base of ["skills", path.join(".claude", "skills")]) {
    const root = path.join(repoPath, base);
    for (const entry of safeReadDir(root)) {
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith("_")) continue;
      const skillFile = path.join(root, entry.name, "SKILL.md");
      if (fs.existsSync(skillFile)) names.add(entry.name);
    }
  }
  return Array.from(names).sort();
}

function isGitRepo(repoPath: string): boolean {
  try {
    return fs.statSync(path.join(repoPath, ".git")).isDirectory();
  } catch {
    // .git may also be a file (worktree pointer); accept either
    try {
      return fs.statSync(path.join(repoPath, ".git")).isFile();
    } catch {
      return false;
    }
  }
}

function isIgnored(repoPath: string): boolean {
  return fs.existsSync(path.join(repoPath, IGNORE_MARKER));
}

export function loadDiscoveredRepos(): DiscoveredRepo[] {
  const entries = safeReadDir(discoveryRoot);
  const repos: DiscoveredRepo[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith(".")) continue;
    const repoPath = path.join(discoveryRoot, entry.name);
    if (!isGitRepo(repoPath)) continue;
    if (isIgnored(repoPath)) continue;
    repos.push({
      name: entry.name,
      slug: slugify(entry.name),
      path: repoPath,
      summary: extractSummary(repoPath),
      hasGit: true,
      hasClaudeMd: fs.existsSync(path.join(repoPath, "CLAUDE.md")),
      localAgents: listLocalAgents(repoPath),
      localSkills: listLocalSkills(repoPath),
      source: "discovery",
    });
  }
  return repos.sort((a, b) => a.name.localeCompare(b.name));
}
