import { filterEligible } from "@/lib/eligibleAgents";
import type { GlossaryTerm } from "@/lib/glossary";

export interface RoutableAgent {
  slug: string;
  description?: string;
  skills: string[];
}

export interface RouteResult {
  assigneeSlug: string | null;
  reason: string;
}

function tokenize(text: string): Set<string> {
  return new Set(text.toLowerCase().match(/[a-z0-9][a-z0-9-]{2,}/g) ?? []);
}

const STOPWORDS = new Set([
  "the", "and", "for", "with", "from", "that", "this", "are", "was", "you",
  "your", "into", "about", "then", "them", "they", "have", "has", "not",
  "all", "any", "can", "will", "when", "what", "how", "use", "using",
]);

/**
 * Build a lowercased alias->canonical token map from a glossary (spec 0031,
 * ADR-024). Each alias token collapses to its canonical term token so an alias
 * in the issue text matches the canonical term in an agent description.
 *
 * Only single-token terms and aliases are handled: the shared `tokenize` regex
 * splits multi-word entries, so multi-word terms/aliases would not survive as a
 * single key. Those are skipped here rather than crashing. The canonical token
 * also maps to itself, so normalization is idempotent.
 */
function buildAliasMap(glossary: GlossaryTerm[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const entry of glossary) {
    const canonTokens = [...tokenize(entry.term)];
    if (canonTokens.length !== 1) continue; // skip multi-word terms
    const canonical = canonTokens[0];
    map.set(canonical, canonical);
    for (const alias of entry.aliases ?? []) {
      const aliasTokens = [...tokenize(alias)];
      if (aliasTokens.length !== 1) continue; // skip multi-word aliases
      map.set(aliasTokens[0], canonical);
    }
  }
  return map;
}

/** Map every token in `tokens` through `aliasMap` (unmapped tokens pass through). */
function normalizeTokens(tokens: Set<string>, aliasMap: Map<string, string>): Set<string> {
  if (aliasMap.size === 0) return tokens;
  const out = new Set<string>();
  for (const token of tokens) out.add(aliasMap.get(token) ?? token);
  return out;
}

/**
 * Deterministic routing per ADR-007: score each eligible non-lead agent
 * against the issue text. Description keyword matches weigh 3, skill-name
 * matches weigh 1. Ties break alphabetically for reproducibility.
 */
export function routeIssue(
  issue: { title: string; body: string },
  projectCapabilities: string[],
  agents: RoutableAgent[],
  glossary?: GlossaryTerm[]
): RouteResult {
  // Empty/absent glossary -> empty map -> normalizeTokens is a no-op, so the
  // three-argument call site stays byte-identical to its prior behavior.
  const aliasMap = buildAliasMap(glossary ?? []);

  const issueTokens = normalizeTokens(tokenize(`${issue.title} ${issue.body}`), aliasMap);
  for (const w of STOPWORDS) issueTokens.delete(w);

  const candidates = filterEligible(agents, projectCapabilities).filter(
    (a) => !a.slug.endsWith("-lead")
  );
  if (candidates.length === 0) {
    return { assigneeSlug: null, reason: "no eligible non-lead agents for this project" };
  }

  let best: { agent: RoutableAgent; score: number; hits: string[] } | null = null;
  for (const agent of [...candidates].sort((a, b) => a.slug.localeCompare(b.slug))) {
    const hits: string[] = [];
    let score = 0;

    const descTokens = normalizeTokens(tokenize(agent.description ?? ""), aliasMap);
    for (const w of STOPWORDS) descTokens.delete(w);
    for (const token of descTokens) {
      if (issueTokens.has(token)) {
        score += 3;
        hits.push(token);
      }
    }

    for (const skill of agent.skills) {
      const skillTokens = tokenize(skill);
      for (const token of skillTokens) {
        if (issueTokens.has(token)) {
          score += 1;
          hits.push(`skill:${skill}`);
          break;
        }
      }
    }

    if (score > 0 && (!best || score > best.score)) {
      best = { agent, score, hits };
    }
  }

  if (!best) {
    return { assigneeSlug: null, reason: "no agent matched the issue text" };
  }
  return {
    assigneeSlug: best.agent.slug,
    reason: `score ${best.score} (${[...new Set(best.hits)].slice(0, 6).join(", ")})`,
  };
}
