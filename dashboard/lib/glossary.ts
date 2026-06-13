// Domain glossary parser and context-block renderer (spec 0031, ADR-024).
// Reads the markdown source of truth at product/glossary.md into terms, then
// renders a compact, budget-capped block prepended to agent context at spawn.

export interface GlossaryTerm {
  term: string;
  definition: string;
  aliases?: string[];
}

// Matches one source line of the form:
//   - **term** (alias1, alias2): definition
// The aliases group is optional:
//   - **term**: definition
const TERM_LINE = /^-\s+\*\*(.+?)\*\*\s*(?:\(([^)]*)\))?\s*:\s*(.+?)\s*$/;

/**
 * Parse the glossary markdown into terms. Returns [] on empty or whitespace
 * input. A malformed line is skipped silently; this never throws.
 */
export function parseGlossary(md: string): GlossaryTerm[] {
  if (!md || !md.trim()) return [];

  const terms: GlossaryTerm[] = [];
  for (const raw of md.split(/\r?\n/)) {
    const match = TERM_LINE.exec(raw.trim());
    if (!match) continue;

    const term = match[1].trim();
    const definition = match[3].trim();
    if (!term || !definition) continue;

    const aliases = (match[2] ?? "")
      .split(",")
      .map((a) => a.trim())
      .filter((a) => a.length > 0);

    const parsed: GlossaryTerm = { term, definition };
    if (aliases.length > 0) parsed.aliases = aliases;
    terms.push(parsed);
  }
  return terms;
}

const BLOCK_HEADER = "Glossary (shared vocabulary):";

function renderTerm(t: GlossaryTerm): string {
  const aliasPart = t.aliases && t.aliases.length > 0 ? ` (aka ${t.aliases.join(", ")})` : "";
  return `- ${t.term}${aliasPart}: ${t.definition}`;
}

/**
 * Render a compact text block of the terms for prepending to agent context.
 * The result length is always <= budget: terms are dropped whole until the
 * block fits. An empty terms array or budget <= 0 returns "". If even the
 * header plus the first term would exceed budget, returns "".
 */
export function glossaryContextBlock(terms: GlossaryTerm[], budget: number): string {
  if (budget <= 0 || terms.length === 0) return "";

  const lines = [BLOCK_HEADER];
  let length = BLOCK_HEADER.length;

  for (const t of terms) {
    const line = renderTerm(t);
    const added = line.length + 1; // +1 for the joining newline
    if (length + added > budget) break;
    lines.push(line);
    length += added;
  }

  // Only the header survived: no term fit, so emit nothing useful.
  if (lines.length === 1) return "";

  return lines.join("\n");
}
