import type { TaskRow } from "./db";

// Decode the JSON-encoded `labels` column. Returns [] on null, malformed JSON,
// or anything that isn't an array of strings.
export function parseLabels(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === "string")
      : [];
  } catch {
    return [];
  }
}

// Issue detail vs prompt-only fallback. Use /issues/[id] when the task has a
// title (an "issue"); otherwise the freeform /tasks/[id] path.
export function taskHref(t: Pick<TaskRow, "id" | "title">): string {
  return t.title ? `/issues/${t.id}` : `/tasks/${t.id}`;
}

// Title to render in card/list contexts. Falls back to the prompt prefix
// truncated to `max` chars (default 60).
export function displayTitle(t: Pick<TaskRow, "title" | "prompt">, max = 60): string {
  if (t.title && t.title.trim().length > 0) return t.title;
  const p = t.prompt.trim();
  return p.length > max ? p.slice(0, max) + "…" : p;
}
