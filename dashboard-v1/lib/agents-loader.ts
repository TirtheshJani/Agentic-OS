import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { agentsPath, repoRoot } from "./paths";

export type AgentRole = "lead" | "member";

export type AgentFrontmatter = {
  name: string;
  description?: string;
  model?: string;
  department: string;
  role: AgentRole;
  "allowed-skills"?: string[];
  "allowed-tools"?: string;
  "system-prompt"?: string;
  "default-repo"?: string;
};

export type Agent = {
  name: string;
  description: string;
  model: string;
  department: string;
  role: AgentRole;
  allowedSkills: string[];
  allowedTools: string | null;
  systemPromptPath: string | null;
  // Phase 8.4: absolute path to the repo this agent should launch in by
  // default when "Open in terminal" is clicked. null when unset. Resolved
  // here (loader), validated for existence at validate-time only.
  defaultRepo: string | null;
  folder: string;
};

// Matches resolveProjectPath in projects-loader.ts. Mirrors the same rules:
// absolute paths resolve as-is, Windows drive-letter paths resolve as-is,
// anything else is treated as repo-root-relative.
function resolveDefaultRepo(raw: string): string {
  if (!raw) return repoRoot;
  if (path.isAbsolute(raw)) return path.resolve(raw);
  if (/^[a-zA-Z]:[\\/]/.test(raw)) return path.resolve(raw);
  return path.resolve(repoRoot, raw);
}

const DEPARTMENTS = [
  "research",
  "coding",
  "content",
  "business",
  "productivity",
] as const;

export type Department = (typeof DEPARTMENTS)[number];

export function isDepartment(s: string): s is Department {
  return (DEPARTMENTS as readonly string[]).includes(s);
}

export const DEPARTMENT_ORDER: Department[] = [...DEPARTMENTS];

function walkAgentMd(dir: string, acc: string[] = []): string[] {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory() && e.name !== "_prompts") {
      walkAgentMd(full, acc);
    } else if (e.isFile() && e.name.endsWith(".md")) {
      acc.push(full);
    }
  }
  return acc;
}

export function loadAgents(): Agent[] {
  const files = walkAgentMd(agentsPath);
  const agents: Agent[] = [];
  for (const file of files) {
    const raw = fs.readFileSync(file, "utf8");
    const fm = matter(raw).data as AgentFrontmatter;
    if (!fm.name || !fm.department || !fm.role) continue;
    const folder = path.relative(agentsPath, path.dirname(file));
    const rawDefaultRepo =
      typeof fm["default-repo"] === "string" && fm["default-repo"].trim().length > 0
        ? fm["default-repo"].trim()
        : null;
    agents.push({
      name: fm.name,
      description: fm.description ?? "",
      model: fm.model ?? "opus",
      department: fm.department,
      role: fm.role,
      allowedSkills: Array.isArray(fm["allowed-skills"]) ? fm["allowed-skills"] : [],
      allowedTools: typeof fm["allowed-tools"] === "string" ? fm["allowed-tools"] : null,
      systemPromptPath: typeof fm["system-prompt"] === "string" ? fm["system-prompt"] : null,
      defaultRepo: rawDefaultRepo ? resolveDefaultRepo(rawDefaultRepo) : null,
      folder,
    });
  }
  return agents.sort((a, b) => {
    const aOrder = DEPARTMENT_ORDER.indexOf(a.department as Department);
    const bOrder = DEPARTMENT_ORDER.indexOf(b.department as Department);
    if (aOrder !== bOrder) return aOrder - bOrder;
    if (a.role !== b.role) return a.role === "lead" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

export function agentsByDepartment(agents: Agent[]): Map<string, Agent[]> {
  const map = new Map<string, Agent[]>();
  for (const dept of DEPARTMENT_ORDER) map.set(dept, []);
  for (const a of agents) {
    if (!map.has(a.department)) map.set(a.department, []);
    map.get(a.department)!.push(a);
  }
  return map;
}

export function leadFor(department: string, agents: Agent[]): Agent | null {
  return agents.find((a) => a.department === department && a.role === "lead") ?? null;
}

export function agentByName(name: string): Agent | null {
  return loadAgents().find((a) => a.name === name) ?? null;
}
