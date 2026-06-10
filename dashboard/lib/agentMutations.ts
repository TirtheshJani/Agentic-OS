import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { AGENTS_DIR } from "@/lib/paths";
import { parseAgentFile, type Agent } from "@/lib/agents";
import { getRuntime } from "@/lib/runtime/registry";
import { listSkills } from "@/lib/skills";
import { slugRegex } from "@/lib/schemas";

export interface AgentInput {
  name: string;
  slug: string;
  description?: string;
  runtime: string;
  skills: string[];
  allowedTools: string[];
  systemPrompt: string;
}

export interface MutationOpts {
  rootDir?: string;
  /** Override the skills root for validation (tests). */
  skillsRootDir?: string;
}

export class AgentValidationError extends Error {
  constructor(public readonly errors: string[]) {
    super(errors.join("; "));
    this.name = "AgentValidationError";
  }
}

function validate(input: AgentInput, opts: MutationOpts & { isCreate: boolean }): void {
  const errors: string[] = [];
  if (!input.name.trim()) errors.push("name is required");
  if (!slugRegex.test(input.slug)) errors.push("slug must be lowercase letters, digits, and hyphens");
  if (!input.systemPrompt.trim()) errors.push("system prompt is required");
  if (!getRuntime(input.runtime)) errors.push(`runtime not registered: ${input.runtime}`);
  if (input.allowedTools.some((t) => !t.trim())) errors.push("allowed-tools entries must be non-empty");

  // Agent frontmatter references skills by name OR by domain (e.g.
  // research-lead lists the whole "research" domain). Accept both.
  const known = new Set<string>();
  for (const s of listSkills(opts.skillsRootDir)) {
    known.add(s.name);
    known.add(s.domain);
  }
  for (const skill of input.skills) {
    if (!known.has(skill)) errors.push(`unknown skill: ${skill}`);
  }

  const filePath = agentPath(input.slug, opts.rootDir);
  if (opts.isCreate && fs.existsSync(filePath)) errors.push(`agent already exists: ${input.slug}`);

  if (errors.length > 0) throw new AgentValidationError(errors);
}

function agentPath(slug: string, rootDir: string = AGENTS_DIR): string {
  return path.join(rootDir, `${slug}.md`);
}

function writeAgentFile(input: AgentInput, created: string, rootDir: string = AGENTS_DIR): Agent {
  const frontmatter: Record<string, unknown> = {
    name: input.name,
    slug: input.slug,
    ...(input.description?.trim() ? { description: input.description.trim() } : {}),
    runtime: input.runtime,
    skills: input.skills,
    "allowed-tools": input.allowedTools,
    created,
  };
  const content = `# System Prompt\n\n${input.systemPrompt.trim()}\n`;
  const filePath = agentPath(input.slug, rootDir);
  fs.writeFileSync(filePath, matter.stringify(content, frontmatter));
  console.log(`[agentMutations] wrote ${filePath}`);
  return parseAgentFile(filePath);
}

export function createAgent(input: AgentInput, opts: MutationOpts = {}): Agent {
  validate(input, { ...opts, isCreate: true });
  const created = new Date().toISOString().slice(0, 10);
  return writeAgentFile(input, created, opts.rootDir);
}

export function updateAgent(slug: string, patch: Partial<AgentInput>, opts: MutationOpts = {}): Agent {
  const filePath = agentPath(slug, opts.rootDir);
  if (!fs.existsSync(filePath)) throw new AgentValidationError([`agent not found: ${slug}`]);
  if (patch.slug && patch.slug !== slug) {
    throw new AgentValidationError(["slug cannot be changed; archive and recreate instead"]);
  }
  const existing = parseAgentFile(filePath);
  const merged: AgentInput = {
    name: patch.name ?? existing.name,
    slug,
    description: patch.description ?? existing.description,
    runtime: patch.runtime ?? existing.runtime,
    skills: patch.skills ?? existing.skills,
    allowedTools: patch.allowedTools ?? existing["allowed-tools"],
    systemPrompt: patch.systemPrompt ?? existing.systemPrompt,
  };
  validate(merged, { ...opts, isCreate: false });
  return writeAgentFile(merged, existing.created, opts.rootDir);
}

export function archiveAgent(slug: string, opts: MutationOpts = {}): void {
  const rootDir = opts.rootDir ?? AGENTS_DIR;
  const filePath = agentPath(slug, rootDir);
  if (!fs.existsSync(filePath)) throw new AgentValidationError([`agent not found: ${slug}`]);
  const archiveDir = path.join(rootDir, "_archive");
  fs.mkdirSync(archiveDir, { recursive: true });
  // listAgents only reads root-level files, so anything in _archive/ is
  // invisible to the dashboard but stays recoverable in git history and disk.
  fs.renameSync(filePath, path.join(archiveDir, `${slug}.md`));
  console.log(`[agentMutations] archived ${slug}`);
}
