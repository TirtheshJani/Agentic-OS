import { TEST_REPO_ROOT, cleanupTestRepoRoot } from "./helpers/repoRootStub";
import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { openDb, getDb, closeDb } from "@/lib/db";
import { resetBusForTesting } from "@/lib/stream";
import { resetSettingsForTesting, setSettings, getSettings } from "@/lib/settings";
import { createIssue } from "@/lib/issues";
import { ingestRun } from "@/lib/lightrag/ingestWorker";

const SLUG = "lr-proj";
const vaultDir = path.join(TEST_REPO_ROOT, "vault");

let fetchCalls: Array<{ url: string; body: unknown }> = [];
let fetchOk = true;

function writeProject(lightragIngest: boolean) {
  const dir = path.join(vaultDir, "projects", SLUG);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, "PROJECT.md"),
    [
      "---",
      `name: LR Proj`,
      `slug: ${SLUG}`,
      `path: ${dir.replace(/\\/g, "/")}`,
      `lightrag-ingest: ${lightragIngest}`,
      "created: 2026-06-11",
      "---",
      "",
    ].join("\n")
  );
}

beforeEach(() => {
  fetchCalls = [];
  fetchOk = true;
  vi.stubGlobal("fetch", async (url: string | URL, init?: RequestInit) => {
    fetchCalls.push({ url: String(url), body: init?.body ? JSON.parse(String(init.body)) : null });
    return { ok: fetchOk, status: fetchOk ? 200 : 500 } as Response;
  });
  process.env.AGENTIC_OS_STATE_DIR = path.join(TEST_REPO_ROOT, ".agentic-os");
  resetSettingsForTesting();
  openDb(path.join(TEST_REPO_ROOT, `state-lr-${Date.now()}-${Math.random()}.db`));
  writeProject(true);
});

afterEach(() => {
  vi.unstubAllGlobals();
  resetBusForTesting();
  resetSettingsForTesting();
  closeDb();
  fs.rmSync(path.join(vaultDir, "projects", SLUG), { recursive: true, force: true });
});

afterAll(() => {
  cleanupTestRepoRoot();
});

function makeRunEvent(overrides: Partial<{ exitStatus: "done" | "failed"; runId: number }> = {}) {
  const issueId = createIssue({ projectSlug: SLUG, title: "Test issue", body: "Body" });
  return {
    kind: "run.finalized" as const,
    runId: overrides.runId ?? 1,
    issueId,
    projectSlug: SLUG,
    exitStatus: overrides.exitStatus ?? ("done" as const),
  };
}

describe("lightrag ingestRun", () => {
  it("no-ops when the global toggle is off", async () => {
    expect(getSettings().lightrag.autoIngest).toBe(false);
    await ingestRun(makeRunEvent());
    expect(fetchCalls).toEqual([]);
  });

  it("no-ops when the project has not opted in", async () => {
    setSettings({ lightrag: { baseUrl: "http://localhost:9621", autoIngest: true } });
    writeProject(false);
    await ingestRun(makeRunEvent());
    expect(fetchCalls).toEqual([]);
  });

  it("no-ops for failed runs", async () => {
    setSettings({ lightrag: { baseUrl: "http://localhost:9621", autoIngest: true } });
    await ingestRun(makeRunEvent({ exitStatus: "failed" }));
    expect(fetchCalls).toEqual([]);
  });

  it("ingests a clean run once and dedupes by run id", async () => {
    setSettings({ lightrag: { baseUrl: "http://lr.test:9621", autoIngest: true } });
    const event = makeRunEvent({ runId: 42 });
    await ingestRun(event);
    await ingestRun(event);
    expect(fetchCalls.length).toBe(1);
    expect(fetchCalls[0].url).toBe("http://lr.test:9621/documents/text");
    const body = fetchCalls[0].body as { text: string; file_source: string };
    expect(body.file_source).toBe("agentic-os/run-42");
    expect(body.text).toContain("Test issue");
    const log = getDb().prepare("SELECT status FROM lightrag_ingest_log WHERE run_id = 42").get() as { status: string };
    expect(log.status).toBe("ok");
  });

  it("records failures without throwing", async () => {
    setSettings({ lightrag: { baseUrl: "http://lr.test:9621", autoIngest: true } });
    fetchOk = false;
    await ingestRun(makeRunEvent({ runId: 7 }));
    const log = getDb().prepare("SELECT status FROM lightrag_ingest_log WHERE run_id = 7").get() as { status: string };
    expect(log.status).toBe("failed");
  });
});
