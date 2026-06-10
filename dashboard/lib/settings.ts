import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { defaultWorkspaceRoot, STATE_DIR as DEFAULT_STATE_DIR, SETTINGS_PATH as DEFAULT_SETTINGS_PATH } from "@/lib/paths";

const AutonomySchema = z.object({
  /** Global kill switch: when false, the auto-router and scheduler no-op. */
  enabled: z.boolean().default(false),
  /** Allow one tiny headless claude -p call as a routing fallback (credit-pool cost). */
  llmRouting: z.boolean().default(false),
  /** Fire automations/remote/*.md cron specs from inside the dashboard. */
  schedulerEnabled: z.boolean().default(false),
  /** Max ancestors a handoff-created issue may have before it is forced to backlog. */
  maxChainDepth: z.number().int().positive().default(3),
});

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
  };
  fs.mkdirSync(stateDir(), { recursive: true });
  fs.writeFileSync(settingsPath(), JSON.stringify(next, null, 2));
  cache = next;
  return next;
}

export function resetSettingsForTesting() {
  cache = null;
}
