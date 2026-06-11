// dashboard/lib/createProject/draft.ts
// The orchestrator draft: ONE headless claude -p call plans the whole
// project (meta + agent team + kickoff issues). Headless subscription use
// draws from the monthly Agent SDK credit pool, so this must never loop or
// retry (same policy as app/api/agents/draft).
import { spawnSync } from "node:child_process";
import { z } from "zod";
import { extractJsonObject } from "@/lib/llm/extractJson";
import { slugify } from "@/lib/projectMutations";

const CLAUDE_BIN = process.platform === "win32" ? "claude.cmd" : "claude";

export const KNOWN_TOOLS = ["Read", "Write", "Edit", "Glob", "Grep", "Bash", "WebFetch", "WebSearch"];

const MAX_TEAM = 4;
const MAX_SEED_ISSUES = 5;
const MAX_CAPABILITIES = 6;

const TeamMemberSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().default(""),
  skills: z.array(z.string()).default([]),
  allowedTools: z.array(z.string()).default([]),
  systemPrompt: z.string().min(1),
  runtime: z.string().default("claude-code"),
});

export const OrchestratorDraftSchema = z.object({
  project: z.object({
    name: z.string().min(1),
    slug: z.string().min(1),
    description: z.string().default(""),
    capabilities: z.array(z.string()).default([]),
  }),
  team: z.array(TeamMemberSchema).min(1),
  seedIssues: z
    .array(z.object({ title: z.string().min(1), body: z.string().default("") }))
    .min(1),
});

export type OrchestratorDraft = z.infer<typeof OrchestratorDraftSchema>;

export function buildOrchestratorPrompt(
  userPrompt: string,
  skillNames: string[],
  runtimeIds: string[]
): string {
  return [
    "You are the orchestrator for a personal agent dashboard. Plan a new software project from the request below.",
    "Respond with ONLY a JSON object, no markdown fences and no prose, with exactly these keys:",
    "project: { name (short human title), slug (kebab-case), description (1-3 sentences), capabilities (3-6 short lowercase domain tags) }",
    "team: an array of 2 to 4 agent profiles, each {",
    "  name (kebab-case identifier, same as slug), slug (kebab-case),",
    "  description (1-2 sentences rich in domain keywords; it is used for task routing),",
    `  skills (array, choose ONLY from: ${skillNames.join(", ")}),`,
    `  allowedTools (array, choose from: ${KNOWN_TOOLS.join(", ")}),`,
    "  systemPrompt (the agent's system prompt, 100-250 words, imperative voice, second person),",
    `  runtime (one of: ${runtimeIds.join(", ")}) }`,
    "seedIssues: an array of 2 to 5 kickoff tasks, each { title (imperative, under 80 chars), body (2-6 sentences including acceptance criteria) }",
    `The project request: ${userPrompt}`,
  ].join("\n");
}

export function runOrchestratorDraft(
  prompt: string
): { ok: true; raw: string } | { ok: false; error: string } {
  // ONE call. Timeout is 90s (vs 60s for agent drafts) because the reply is
  // roughly 4x larger.
  const r = spawnSync(CLAUDE_BIN, ["-p", prompt, "--output-format", "json"], {
    encoding: "utf8",
    shell: process.platform === "win32",
    timeout: 90_000,
    maxBuffer: 8 * 1024 * 1024,
  });
  if (r.error || r.status !== 0) {
    const detail = r.error?.message || r.stderr || `exit ${r.status}`;
    return { ok: false, error: `orchestrator draft failed: ${detail}` };
  }
  return { ok: true, raw: r.stdout };
}

export function parseOrchestratorDraft(
  stdout: string
): { ok: true; draft: OrchestratorDraft } | { ok: false; error: string; raw: string } {
  // claude -p --output-format json wraps the reply in an envelope whose
  // `result` field holds the assistant text.
  let resultText = stdout;
  const envelope = extractJsonObject(stdout) as { result?: unknown } | null;
  if (envelope && typeof envelope.result === "string") resultText = envelope.result;

  const raw = extractJsonObject(resultText);
  const parsed = OrchestratorDraftSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "model reply was not a valid project draft", raw: resultText.slice(0, 2000) };
  }
  return { ok: true, draft: parsed.data };
}

/**
 * Clamp the draft to known skills/tools/runtimes and sane sizes. Drops and
 * warns instead of failing wherever safe (same policy as agents/draft).
 */
export function sanitizeDraft(
  draft: OrchestratorDraft,
  knownSkills: Set<string>,
  knownRuntimes: Set<string>,
  fallbackRuntime: string
): { draft: OrchestratorDraft; warnings: string[] } {
  const warnings: string[] = [];

  let team = draft.team.map((member) => {
    const slug = slugify(member.slug || member.name);
    const skills = member.skills.filter((s) => knownSkills.has(s));
    if (skills.length < member.skills.length) {
      warnings.push(`agent ${slug}: dropped unknown skills ${member.skills.filter((s) => !knownSkills.has(s)).join(", ")}`);
    }
    const allowedTools = member.allowedTools.filter((t) => KNOWN_TOOLS.includes(t));
    let runtime = member.runtime;
    if (!knownRuntimes.has(runtime)) {
      warnings.push(`agent ${slug}: unknown runtime "${runtime}" replaced with ${fallbackRuntime}`);
      runtime = fallbackRuntime;
    }
    return { ...member, slug, name: member.name.trim() || slug, skills, allowedTools, runtime };
  });
  if (team.length > MAX_TEAM) {
    warnings.push(`team of ${team.length} trimmed to ${MAX_TEAM}`);
    team = team.slice(0, MAX_TEAM);
  }
  if (team.length < 2) {
    warnings.push("draft returned a single-agent team; proceeding");
  }
  // Dedupe team slugs (model occasionally repeats one).
  const seen = new Set<string>();
  team = team.filter((m) => {
    if (seen.has(m.slug)) {
      warnings.push(`duplicate team slug ${m.slug} dropped`);
      return false;
    }
    seen.add(m.slug);
    return true;
  });

  let seedIssues = draft.seedIssues;
  if (seedIssues.length > MAX_SEED_ISSUES) {
    warnings.push(`${seedIssues.length} seed issues trimmed to ${MAX_SEED_ISSUES}`);
    seedIssues = seedIssues.slice(0, MAX_SEED_ISSUES);
  }

  const capabilities = Array.from(
    new Set(draft.project.capabilities.map((c) => c.trim().toLowerCase()).filter(Boolean))
  ).slice(0, MAX_CAPABILITIES);

  const project = {
    ...draft.project,
    slug: slugify(draft.project.slug || draft.project.name),
    capabilities,
  };

  return { draft: { project, team, seedIssues }, warnings };
}
