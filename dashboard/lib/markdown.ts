// dashboard/lib/markdown.ts
// Minimal markdown helpers shared by the acceptance-contract and handoff parsers
// (spec 0029). Kept tiny and dependency-free so both lib/evals/contract.ts and
// lib/handoff.ts read the same section structure instead of each rolling their own.

export interface H2Section {
  heading: string;
  body: string;
}

/**
 * Split a markdown document into its `## ` (h2) sections. A section's body is
 * every line after its heading up to the next `## ` heading or end of file.
 * Content before the first h2 is ignored; deeper headings (`###`+) stay inside
 * the enclosing h2 body. Headings are trimmed; bodies are returned verbatim so
 * callers decide how to trim or tokenize them.
 */
export function splitH2Sections(markdown: string): H2Section[] {
  const lines = markdown.split(/\r?\n/);
  const sections: H2Section[] = [];
  let heading: string | null = null;
  let buf: string[] = [];

  const flush = () => {
    if (heading != null) sections.push({ heading, body: buf.join("\n") });
    buf = [];
  };

  for (const line of lines) {
    const m = line.match(/^##\s+(.+?)\s*$/);
    if (m) {
      flush();
      heading = m[1].trim();
    } else if (heading != null) {
      buf.push(line);
    }
  }
  flush();
  return sections;
}
