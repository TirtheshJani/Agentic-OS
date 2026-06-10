import { filterEligible } from "@/lib/eligibleAgents";

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
 * Deterministic routing per ADR-007: score each eligible non-lead agent
 * against the issue text. Description keyword matches weigh 3, skill-name
 * matches weigh 1. Ties break alphabetically for reproducibility.
 */
export function routeIssue(
  issue: { title: string; body: string },
  projectCapabilities: string[],
  agents: RoutableAgent[]
): RouteResult {
  const issueTokens = tokenize(`${issue.title} ${issue.body}`);
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

    const descTokens = tokenize(agent.description ?? "");
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
