// dashboard/lib/lightrag/ingestWorker.ts
// Optional LightRAG auto-ingest (spec 0016): when a run finishes cleanly, POST
// its issue + thread to the local LightRAG instance. Double-gated: the global
// settings toggle AND the project's lightrag-ingest frontmatter must both be
// on. Failures are logged, never block run finalization.
import { getDb } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { getProject } from "@/lib/projects";
import { getIssue } from "@/lib/issues";
import { readThread } from "@/lib/threads";
import { subscribe, type StreamEvent } from "@/lib/stream";

interface WorkerState {
  stop: () => void;
}

const globalKey = Symbol.for("agentic-os.lightragIngest");
const g = globalThis as unknown as Record<symbol, WorkerState | undefined>;

export async function ingestRun(event: Extract<StreamEvent, { kind: "run.finalized" }>): Promise<void> {
  const settings = getSettings();
  if (!settings.lightrag.autoIngest) return;
  if (event.exitStatus !== "done") return;

  const project = getProject(event.projectSlug);
  if (!project || !project["lightrag-ingest"]) return;

  const db = getDb();
  const already = db.prepare("SELECT run_id FROM lightrag_ingest_log WHERE run_id = ?").get(event.runId);
  if (already) return;

  const issue = getIssue(event.issueId);
  const thread = readThread(event.projectSlug, event.issueId)
    .map((e) => `${e.eventType ?? e.kind}: ${e.body}`)
    .join("\n");
  const text = [
    `Project: ${event.projectSlug}`,
    `Issue #${event.issueId}: ${issue?.title ?? ""}`,
    issue?.body ?? "",
    "",
    "Thread:",
    thread,
  ].join("\n");

  let status = "ok";
  try {
    const res = await fetch(`${settings.lightrag.baseUrl}/documents/text`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, file_source: `agentic-os/run-${event.runId}` }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) status = "failed";
  } catch (err) {
    console.error(`[lightrag] ingest failed for run ${event.runId}:`, err);
    status = "failed";
  }
  db.prepare("INSERT OR REPLACE INTO lightrag_ingest_log (run_id, ingested_at, status) VALUES (?, ?, ?)").run(
    event.runId,
    Date.now(),
    status
  );
  console.log(`[lightrag] run ${event.runId} ingest: ${status}`);
}

/** Singleton listener on run.finalized. */
export function startLightragIngestWorker(): () => void {
  if (g[globalKey]) return g[globalKey]!.stop;
  const unsubscribe = subscribe((event) => {
    if (event.kind === "run.finalized") void ingestRun(event);
  });
  const stop = () => {
    unsubscribe();
    g[globalKey] = undefined;
  };
  g[globalKey] = { stop };
  return stop;
}
