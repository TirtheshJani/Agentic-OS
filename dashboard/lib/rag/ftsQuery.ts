// dashboard/lib/rag/ftsQuery.ts
/** Quote every term so user input cannot inject FTS5 query syntax. */
export function sanitizeFtsQuery(q: string): string {
  return q
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => `"${t.replace(/"/g, '""')}"`)
    .join(" ");
}
