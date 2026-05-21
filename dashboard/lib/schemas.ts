import { z } from "zod";

const slugRegex = /^[a-z0-9][a-z0-9-]*$/;

// gray-matter parses unquoted YAML dates to JS Date. Coerce to YYYY-MM-DD string.
const DateLike = z.preprocess(
  v => (v instanceof Date ? v.toISOString().slice(0, 10) : v),
  z.string(),
);

export const ProjectFrontmatterSchema = z.object({
  name: z.string().min(1),
  slug: z.string().regex(slugRegex, "slug must be lowercase letters, digits, and hyphens"),
  path: z.string().min(1),
  repo: z.preprocess(v => (v === "" || v == null ? undefined : v), z.string().url().optional()),
  crew: z.array(z.string().regex(slugRegex)).default([]),
  "runtime-default": z.string().default("claude-code"),
  capabilities: z.array(z.string()).default([]),
  "allow-parallel-edits": z.boolean().optional(),
  created: DateLike,
});

export type ProjectFrontmatter = z.infer<typeof ProjectFrontmatterSchema>;

export function parseProjectFrontmatter(raw: unknown): ProjectFrontmatter {
  return ProjectFrontmatterSchema.parse(raw);
}

export const AgentFrontmatterSchema = z.object({
  name: z.string().min(1),
  slug: z.string().regex(slugRegex),
  runtime: z.string().default("claude-code"),
  "allowed-tools": z.array(z.string()).default([]),
  skills: z.array(z.string()).default([]),
  created: DateLike,
});

export type AgentFrontmatter = z.infer<typeof AgentFrontmatterSchema>;

export function parseAgentFrontmatter(raw: unknown): AgentFrontmatter {
  return AgentFrontmatterSchema.parse(raw);
}
