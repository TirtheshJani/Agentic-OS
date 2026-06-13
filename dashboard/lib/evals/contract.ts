// dashboard/lib/evals/contract.ts
// Parse the optional `## Acceptance contract` checklist out of an issue body
// (spec 0029 / ADR-022). The contract is the definition of done authored at
// planning time; the judge grades each assertion pass/fail and derives
// correctness from the pass fraction. An empty result means "no contract", so
// callers fall back to the generic ADR-016 rubric (regression guard).
import { splitH2Sections } from "@/lib/markdown";

export interface Assertion {
  text: string;
  /**
   * True when the checklist line carried a trailing `(e2e)` marker, meaning the
   * behavioral validator can exercise this assertion in a live app. Unmarked
   * assertions are judge-only. The marker is stripped from `text`.
   */
  e2e: boolean;
  /** Set by the judge (or a handoff self-assessment); absent at parse time. */
  pass?: boolean;
  reason?: string;
}

// A markdown checklist item: "- [ ] text" or "- [x] text" (any indent).
const CHECKLIST_RE = /^\s*-\s*\[[ xX]\]\s+(.+?)\s*$/;

// A trailing `(e2e)` marker on an assertion (optional surrounding whitespace).
const E2E_MARKER_RE = /\s*\(e2e\)\s*$/i;

/** Extract acceptance-contract assertions from an issue body, or [] when absent. */
export function parseContract(issueBody: string): Assertion[] {
  if (!issueBody) return [];
  const section = splitH2Sections(issueBody).find((s) => /^acceptance contract$/i.test(s.heading));
  if (!section) return [];

  const assertions: Assertion[] = [];
  for (const line of section.body.split(/\r?\n/)) {
    const m = line.match(CHECKLIST_RE);
    if (!m) continue;
    const raw = m[1].trim();
    const e2e = E2E_MARKER_RE.test(raw);
    const text = e2e ? raw.replace(E2E_MARKER_RE, "").trim() : raw;
    assertions.push({ text, e2e });
  }
  return assertions;
}
