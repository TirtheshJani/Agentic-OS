import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { defaultWorkspaceRoot, STATE_DIR as DEFAULT_STATE_DIR, SETTINGS_PATH as DEFAULT_SETTINGS_PATH } from "@/lib/paths";

const AutonomySchema = z.object({
  /** Global kill switch: when false, the auto-router and scheduler no-op. */
  enabled: z.boolean().default(false),
  /** Route around an unavailable/failed primary runtime to another available
   * runtime at spawn time (spec 0009). Default off: requested runtime used verbatim. */
  llmRouting: z.boolean().default(false),
  /** Fire automations/remote/*.md cron specs from inside the dashboard. */
  schedulerEnabled: z.boolean().default(false),
  /** Max ancestors a handoff-created issue may have before it is forced to backlog. */
  maxChainDepth: z.number().int().positive().default(3),
});

const RagSchema = z.object({
  /** "none" disables vector search; retrieval degrades to FTS + link graph. */
  embeddingProvider: z.enum(["gemini", "none"]).default("none"),
  geminiApiKey: z.string().default(""),
  embeddingModel: z.string().default("gemini-embedding-001"),
  embeddingDims: z.number().int().positive().default(768),
  /** Grounded-answer generation. gemini-cli bills the Google account; claude-cli draws from the Agent SDK credit pool and is explicit opt-in. */
  answerProvider: z.enum(["gemini-cli", "claude-cli", "none"]).default("gemini-cli"),
});

const RAG_DEFAULTS = {
  embeddingProvider: "none" as const,
  geminiApiKey: "",
  embeddingModel: "gemini-embedding-001",
  embeddingDims: 768,
  answerProvider: "gemini-cli" as const,
};

/** Feature-flagged dashboard surfaces. Off hides the view from the nav;
 * routes stay URL-reachable (localhost, single operator — no gating). */
const FeaturesSchema = z.object({
  notes: z.boolean().default(true),
  inbox: z.boolean().default(true),
  ask: z.boolean().default(true),
  graph: z.boolean().default(true),
  learning: z.boolean().default(true),
  research: z.boolean().default(true),
  studio: z.boolean().default(true),
  sessions: z.boolean().default(true),
  analytics: z.boolean().default(true),
  evals: z.boolean().default(true),
  docker: z.boolean().default(true),
  connections: z.boolean().default(true),
});

export type FeatureKey = keyof z.infer<typeof FeaturesSchema>;

const FEATURES_DEFAULTS: z.infer<typeof FeaturesSchema> = {
  notes: true,
  inbox: true,
  ask: true,
  graph: true,
  learning: true,
  research: true,
  studio: true,
  sessions: true,
  analytics: true,
  evals: true,
  docker: true,
  connections: true,
};

const SettingsSchema = z.object({
  workspaceRoot: z.string(),
  concurrency: z.object({
    perProjectMax: z.number().int().positive(),
    globalMax: z.number().int().positive(),
  }),
  theme: z.enum(["light", "dark", "system"]).default("system"),
  autonomy: AutonomySchema.default({
    enabled: false,
    llmRouting: false,
    schedulerEnabled: false,
    maxChainDepth: 3,
  }),
  rag: RagSchema.default(RAG_DEFAULTS),
  lightrag: z
    .object({
      baseUrl: z.string().default("http://localhost:9621"),
      /** Global gate for auto-ingesting finished runs; projects also opt in via frontmatter. */
      autoIngest: z.boolean().default(false),
    })
    .default({ baseUrl: "http://localhost:9621", autoIngest: false }),
  export: z
    .object({
      /** Bundle target; point at a Google Drive for Desktop folder for NotebookLM. "" falls back to vault/outputs/notebooklm. */
      notebookLmDir: z.string().default(""),
    })
    .default({ notebookLmDir: "" }),
  evals: z
    .object({
      /** "inherit" follows rag.answerProvider; the judge is one CLI call per grade. */
      judgeProvider: z.enum(["inherit", "gemini-cli", "claude-cli", "none"]).default("inherit"),
      /** Auto-judge finished runs; also requires the global autonomy switch. */
      autoGradeEnabled: z.boolean().default(false),
      batchLimit: z.number().int().positive().default(10),
      /** Judged composite below this files one auto-revision (ADR-021). 0 disables the loop. */
      reviseThreshold: z.number().int().min(0).max(100).default(70),
    })
    .default({ judgeProvider: "inherit", autoGradeEnabled: false, batchLimit: 10, reviseThreshold: 70 }),
  docker: z
    .object({
      enabled: z.boolean().default(false),
      /** Compose project names whose start/stop/restart is permitted. */
      allowlist: z.array(z.string()).default([]),
    })
    .default({ enabled: false, allowlist: [] }),
  features: FeaturesSchema.default(FEATURES_DEFAULTS),
});

export type Settings = z.infer<typeof SettingsSchema>;

function stateDir(): string {
  return process.env.AGENTIC_OS_STATE_DIR ?? DEFAULT_STATE_DIR;
}

function settingsPath(): string {
  return process.env.AGENTIC_OS_STATE_DIR
    ? path.join(process.env.AGENTIC_OS_STATE_DIR, "settings.json")
    : DEFAULT_SETTINGS_PATH;
}

function defaults(): Settings {
  return {
    workspaceRoot: defaultWorkspaceRoot(),
    concurrency: { perProjectMax: 3, globalMax: 5 },
    theme: "system",
    autonomy: { enabled: false, llmRouting: false, schedulerEnabled: false, maxChainDepth: 3 },
    rag: { ...RAG_DEFAULTS },
    lightrag: { baseUrl: "http://localhost:9621", autoIngest: false },
    export: { notebookLmDir: "" },
    evals: { judgeProvider: "inherit", autoGradeEnabled: false, batchLimit: 10, reviseThreshold: 70 },
    docker: { enabled: false, allowlist: [] },
    features: { ...FEATURES_DEFAULTS },
  };
}

let cache: Settings | null = null;

export function getSettings(): Settings {
  if (cache) return cache;
  const p = settingsPath();
  if (!fs.existsSync(p)) {
    cache = defaults();
    return cache;
  }
  const raw = JSON.parse(fs.readFileSync(p, "utf8"));
  const parsed = SettingsSchema.safeParse({ ...defaults(), ...raw });
  cache = parsed.success ? parsed.data : defaults();
  return cache;
}

export function setSettings(patch: Partial<Settings>): Settings {
  const current = getSettings();
  const next: Settings = {
    ...current,
    ...patch,
    concurrency: { ...current.concurrency, ...(patch.concurrency ?? {}) },
    autonomy: { ...current.autonomy, ...(patch.autonomy ?? {}) },
    rag: { ...current.rag, ...(patch.rag ?? {}) },
    lightrag: { ...current.lightrag, ...(patch.lightrag ?? {}) },
    export: { ...current.export, ...(patch.export ?? {}) },
    evals: { ...current.evals, ...(patch.evals ?? {}) },
    docker: { ...current.docker, ...(patch.docker ?? {}) },
    features: { ...current.features, ...(patch.features ?? {}) },
  };
  fs.mkdirSync(stateDir(), { recursive: true });
  fs.writeFileSync(settingsPath(), JSON.stringify(next, null, 2));
  cache = next;
  return next;
}

export function resetSettingsForTesting() {
  cache = null;
}
