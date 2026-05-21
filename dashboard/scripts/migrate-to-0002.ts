#!/usr/bin/env tsx
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

const DEPT_TO_SKILLS: Record<string, string[]> = {
  research: ["research"],
  coding: ["coding"],
  content: ["writing"],
  business: ["business"],
  productivity: ["productivity"],
};

const KNOWN_DEPT_DIRS = Object.keys(DEPT_TO_SKILLS);
const PRESERVED_DIRS = new Set(["_prompts", "_meta"]);
const DONE_MARKER_REL = ".agentic-os/migrations/0002.done";

function repoRoot(): string {
  return process.env.AGENTIC_OS_REPO_ROOT ?? path.resolve(__dirname, "..", "..");
}

function dedupe<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

function isoDateFromMtime(filePath: string): string {
  const stat = fs.statSync(filePath);
  return stat.mtime.toISOString().slice(0, 10);
}

function toToolsArray(raw: unknown): string[] | null {
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === "string") {
    return raw.split(/[\s,]+/).map(s => s.trim()).filter(Boolean);
  }
  return null;
}

function readPromptFile(agentFile: string, relPromptPath: string): string | null {
  const abs = path.resolve(path.dirname(agentFile), relPromptPath);
  if (!fs.existsSync(abs)) return null;
  return fs.readFileSync(abs, "utf8").trim();
}

function normalizeAgentFrontmatter(
  data: Record<string, unknown>,
  filePath: string,
  derivedSlug: string,
  deptHint: string | null,
): { data: Record<string, unknown>; body: string | null } {
  const out: Record<string, unknown> = { ...data };

  out.slug = (typeof out.slug === "string" && out.slug) || derivedSlug;
  if (!out.runtime) out.runtime = "claude-code";
  if (!out.created) out.created = isoDateFromMtime(filePath);

  const tools = toToolsArray(out["allowed-tools"]);
  if (tools) out["allowed-tools"] = tools;
  else if (out["allowed-tools"] === undefined) out["allowed-tools"] = [];

  const existingSkills = Array.isArray(out.skills) ? (out.skills as string[]) : [];
  const existingCaps = Array.isArray(out.capabilities) ? (out.capabilities as string[]) : [];
  const dept = (typeof out.department === "string" ? out.department : "") || deptHint || "";
  const deptSkills = DEPT_TO_SKILLS[dept] ?? [];
  const merged = dedupe([...existingSkills, ...existingCaps, ...deptSkills]);
  out.skills = merged;

  let inlinedBody: string | null = null;
  if (typeof out["system-prompt"] === "string") {
    const promptText = readPromptFile(filePath, out["system-prompt"] as string);
    if (promptText) {
      inlinedBody = `# System Prompt\n\n${promptText}\n`;
    }
  }

  delete out.department;
  delete out.capabilities;
  delete out["system-prompt"];
  delete out.model;
  delete out.role;
  delete out["allowed-skills"];

  return { data: out, body: inlinedBody };
}

function migrateAgents(root: string): { moved: number; normalized: number } {
  const agentsDir = path.join(root, "agents");
  if (!fs.existsSync(agentsDir)) return { moved: 0, normalized: 0 };

  let moved = 0;
  let normalized = 0;

  for (const dept of KNOWN_DEPT_DIRS) {
    const deptDir = path.join(agentsDir, dept);
    if (!fs.existsSync(deptDir) || !fs.statSync(deptDir).isDirectory()) continue;

    const files = fs.readdirSync(deptDir).filter(f => f.endsWith(".md"));
    for (const file of files) {
      const oldPath = path.join(deptDir, file);
      const slug = path.basename(file, ".md");
      const newPath = path.join(agentsDir, file);

      if (fs.existsSync(newPath)) {
        throw new Error(`Migration collision: ${newPath} already exists. Resolve manually before retrying.`);
      }

      const raw = fs.readFileSync(oldPath, "utf8");
      const parsed = matter(raw);
      const { data, body } = normalizeAgentFrontmatter(
        parsed.data as Record<string, unknown>,
        oldPath,
        slug,
        dept,
      );

      const newContent = matter.stringify(body ?? parsed.content, data);
      fs.writeFileSync(newPath, newContent);
      fs.unlinkSync(oldPath);
      moved += 1;
    }

    const remaining = fs.readdirSync(deptDir);
    if (remaining.length === 0) {
      fs.rmdirSync(deptDir);
    }
  }

  const flatEntries = fs.readdirSync(agentsDir, { withFileTypes: true });
  for (const entry of flatEntries) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
    if (entry.name === "README.md" || entry.name === "CLAUDE.md") continue;

    const fp = path.join(agentsDir, entry.name);
    const raw = fs.readFileSync(fp, "utf8");
    const parsed = matter(raw);
    const slug = path.basename(entry.name, ".md");
    const before = JSON.stringify(parsed.data);
    const { data, body } = normalizeAgentFrontmatter(
      parsed.data as Record<string, unknown>,
      fp,
      slug,
      null,
    );
    const after = JSON.stringify(data);

    if (before !== after || body !== null) {
      const newContent = matter.stringify(body ?? parsed.content, data);
      fs.writeFileSync(fp, newContent);
      normalized += 1;
    }
  }

  return { moved, normalized };
}

function normalizeProjectFrontmatter(
  data: Record<string, unknown>,
  filePath: string,
  dirSlug: string,
): { data: Record<string, unknown>; changed: boolean } {
  const out: Record<string, unknown> = { ...data };
  let changed = false;

  if (typeof out["repo-url"] === "string" && !out.repo) {
    out.repo = out["repo-url"];
    delete out["repo-url"];
    changed = true;
  }
  if (!out.slug) {
    out.slug = dirSlug;
    changed = true;
  }
  if (!out.created) {
    out.created = isoDateFromMtime(filePath);
    changed = true;
  }
  if (!Array.isArray(out.crew)) {
    out.crew = [];
    changed = true;
  }
  if (!out["runtime-default"]) {
    out["runtime-default"] = "claude-code";
    changed = true;
  }
  if (!Array.isArray(out.capabilities)) {
    out.capabilities = [];
    changed = true;
  }

  return { data: out, changed };
}

function migrateProjects(root: string): number {
  const projectsRoot = path.join(root, "vault", "projects");
  if (!fs.existsSync(projectsRoot)) return 0;

  const entries = fs.readdirSync(projectsRoot, { withFileTypes: true });
  let updated = 0;
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const fp = path.join(projectsRoot, entry.name, "PROJECT.md");
    if (!fs.existsSync(fp)) continue;
    const raw = fs.readFileSync(fp, "utf8");
    const parsed = matter(raw);
    const { data, changed } = normalizeProjectFrontmatter(
      parsed.data as Record<string, unknown>,
      fp,
      entry.name,
    );
    if (changed) {
      fs.writeFileSync(fp, matter.stringify(parsed.content, data));
      updated += 1;
    }
  }
  return updated;
}

export function runMigration(): { agentsMoved: number; agentsNormalized: number; projectsUpdated: number } {
  const root = repoRoot();
  const doneMarker = path.join(root, DONE_MARKER_REL);

  const agentsResult = migrateAgents(root);
  const projectsUpdated = migrateProjects(root);

  const markerDir = path.dirname(doneMarker);
  fs.mkdirSync(markerDir, { recursive: true });
  fs.writeFileSync(doneMarker, JSON.stringify({ ranAt: new Date().toISOString() }, null, 2));

  return {
    agentsMoved: agentsResult.moved,
    agentsNormalized: agentsResult.normalized,
    projectsUpdated,
  };
}

if (require.main === module) {
  const result = runMigration();
  console.log(
    `Migration complete. Agents moved: ${result.agentsMoved}. ` +
    `Agents normalized: ${result.agentsNormalized}. ` +
    `Projects updated: ${result.projectsUpdated}.`,
  );
}
