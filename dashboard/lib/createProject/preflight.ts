// dashboard/lib/createProject/preflight.ts
// Cheap deterministic checks that run BEFORE the headless draft call so a
// missing gh login never burns an Agent SDK credit.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { getConnectionStatuses, type ConnectionStatus } from "@/lib/connections";

export interface PreflightInput {
  wantRepo: boolean;
  workspaceRoot: string;
  vaultProjectsDir: string;
}

export interface PreflightResult {
  ok: boolean;
  failures: string[];
  warnings: string[];
}

export interface PreflightDeps {
  statuses: () => Promise<ConnectionStatus[]>;
  gitConfigEmail: () => string;
}

function defaultGitConfigEmail(): string {
  // No shell: git is a real .exe, resolved via PATH without one.
  const r = spawnSync("git", ["config", "user.email"], {
    encoding: "utf8",
    timeout: 10_000,
  });
  return (r.stdout ?? "").trim();
}

export async function runPreflight(
  input: PreflightInput,
  deps: Partial<PreflightDeps> = {}
): Promise<PreflightResult> {
  const statuses = await (deps.statuses ?? getConnectionStatuses)();
  const failures: string[] = [];
  const warnings: string[] = [];

  const claude = statuses.find((s) => s.id === "claude");
  if (claude?.status !== "connected") {
    failures.push("claude CLI is not available; the orchestrator draft needs it (run `claude` once and log in)");
  }
  if (input.wantRepo) {
    const github = statuses.find((s) => s.id === "github");
    if (github?.status !== "connected") {
      failures.push("gh CLI is not authenticated; run `gh auth login` or choose local-only");
    }
  }

  const parent = path.dirname(input.workspaceRoot);
  if (!fs.existsSync(input.workspaceRoot) && !fs.existsSync(parent)) {
    failures.push(`workspace root ${input.workspaceRoot} does not exist and cannot be created (parent missing)`);
  }
  try {
    fs.mkdirSync(input.vaultProjectsDir, { recursive: true });
  } catch {
    failures.push(`vault projects dir ${input.vaultProjectsDir} is not writable`);
  }

  const email = (deps.gitConfigEmail ?? defaultGitConfigEmail)();
  if (!email) {
    warnings.push("git config user.email is empty; the scaffold commit may fail");
  }

  return { ok: failures.length === 0, failures, warnings };
}
