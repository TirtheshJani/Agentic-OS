// dashboard/lib/llm/extractJson.ts
// Tolerant JSON extraction for headless `claude -p` replies. Moved verbatim
// from app/api/agents/draft/route.ts (route modules may not export extras).
export function extractJsonObject(text: string): unknown | null {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try { return JSON.parse(cleaned); } catch { /* fall through */ }
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try { return JSON.parse(cleaned.slice(start, end + 1)); } catch { /* fall through */ }
  }
  return null;
}
