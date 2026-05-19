import { runClaude } from "./claude-headless";
import { repoRoot } from "./paths";
import { loadTeams, type Team } from "./teams";

export type RouteDecision = {
  slug: string;
  team: Team;
  reason: string;
  mode: "deterministic" | "llm";
  confidence: number;
};

export type RouteFailure = {
  slug: null;
  reason: string;
  mode: "no-match";
  confidence: 0;
};

export type RouteResult = RouteDecision | RouteFailure;

const STOPWORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "to",
  "of",
  "for",
  "in",
  "on",
  "with",
  "by",
  "at",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "have",
  "has",
  "had",
  "do",
  "does",
  "did",
  "this",
  "that",
  "it",
  "from",
  "as",
  "we",
  "i",
  "my",
]);

function tokens(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length >= 3 && !STOPWORDS.has(t))
  );
}

function nameVariants(team: Team): string[] {
  const out = new Set<string>();
  out.add(team.slug.toLowerCase());
  out.add(team.name.toLowerCase());
  out.add(team.name.toLowerCase().replace(/[-_]/g, " "));
  out.add(team.slug.replace(/-/g, " "));
  // also include hyphen-stripped concatenation so "qmlessentials" matches "qml-essentials"
  out.add(team.slug.replace(/[-_]/g, ""));
  return Array.from(out).filter((s) => s.length >= 3);
}

function deterministicMatch(prompt: string, teams: Team[]): RouteDecision | null {
  const lower = prompt.toLowerCase();
  // Direct mention of slug or name in prompt
  const hits: { team: Team; score: number; variant: string }[] = [];
  for (const team of teams) {
    for (const v of nameVariants(team)) {
      const re = new RegExp(`(?:^|[^a-z0-9])${escapeRegex(v)}(?:[^a-z0-9]|$)`, "i");
      if (re.test(lower)) {
        hits.push({ team, score: v.length, variant: v });
      }
    }
  }
  if (hits.length === 0) return null;
  hits.sort((a, b) => b.score - a.score);
  // If the top hit is a strict superset/longer string than the next, use it.
  // Otherwise the prompt is ambiguous between multiple repos — punt to LLM.
  if (hits.length > 1 && hits[0].team.slug !== hits[1].team.slug && hits[0].score === hits[1].score) {
    return null;
  }
  const winner = hits[0];
  return {
    slug: winner.team.slug,
    team: winner.team,
    reason: `prompt mentions "${winner.variant}"`,
    mode: "deterministic",
    confidence: 0.95,
  };
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildLlmPrompt(prompt: string, teams: Team[]): string {
  const list = teams
    .map(
      (t, i) =>
        `${i + 1}. slug=${t.slug} | name=${t.name} | ${t.description.replace(/\n/g, " ")}`
    )
    .join("\n");
  return [
    "You are a routing classifier. Pick the single repo whose scope best matches the user task.",
    "Respond with ONLY one line of JSON: {\"slug\":\"<slug>\",\"reason\":\"<10 words>\"}.",
    "If no repo fits, respond {\"slug\":null,\"reason\":\"<why>\"}.",
    "",
    "Repos:",
    list,
    "",
    "User task:",
    prompt,
  ].join("\n");
}

async function llmClassify(
  prompt: string,
  teams: Team[],
  signal?: AbortSignal
): Promise<{ slug: string | null; reason: string } | null> {
  const aggregate: string[] = [];
  try {
    for await (const evt of runClaude({
      prompt: buildLlmPrompt(prompt, teams),
      cwd: repoRoot,
      model: process.env.AGENTIC_OS_ROUTER_MODEL ?? "claude-haiku-4-5",
      signal,
    })) {
      if (evt.type === "delta") aggregate.push(evt.data);
      if (evt.type === "error") return null;
    }
  } catch {
    return null;
  }
  const text = aggregate.join("").trim();
  const match = text.match(/\{[\s\S]*?\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]) as { slug?: string | null; reason?: string };
    if (typeof parsed.slug !== "string" && parsed.slug !== null) return null;
    return { slug: parsed.slug ?? null, reason: parsed.reason ?? "" };
  } catch {
    return null;
  }
}

export async function routeToTeam(
  prompt: string,
  opts: { teams?: Team[]; signal?: AbortSignal; allowLlm?: boolean } = {}
): Promise<RouteResult> {
  const teams = (opts.teams ?? loadTeams()).filter((t) => t.pathExists);
  if (teams.length === 0) {
    return { slug: null, reason: "no teams available", mode: "no-match", confidence: 0 };
  }

  const det = deterministicMatch(prompt, teams);
  if (det) return det;

  if (opts.allowLlm === false) {
    return {
      slug: null,
      reason: "no deterministic match and LLM routing disabled",
      mode: "no-match",
      confidence: 0,
    };
  }

  const llm = await llmClassify(prompt, teams, opts.signal);
  if (!llm || !llm.slug) {
    return {
      slug: null,
      reason: llm?.reason ?? "classifier returned no match",
      mode: "no-match",
      confidence: 0,
    };
  }
  const team = teams.find((t) => t.slug === llm.slug);
  if (!team) {
    return {
      slug: null,
      reason: `classifier picked unknown slug "${llm.slug}"`,
      mode: "no-match",
      confidence: 0,
    };
  }
  return {
    slug: team.slug,
    team,
    reason: llm.reason || "llm classification",
    mode: "llm",
    confidence: 0.75,
  };
}
