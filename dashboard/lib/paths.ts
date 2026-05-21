import path from "node:path";
import os from "node:os";

// __dirname is unreliable in Next.js bundled server output. Derive the repo
// root from cwd (dashboard scripts run from dashboard/), with an env override
// for tests or unusual deployments.
function resolveRepoRoot(): string {
  if (process.env.AGENTIC_OS_REPO_ROOT) return process.env.AGENTIC_OS_REPO_ROOT;
  const cwd = process.cwd();
  if (path.basename(cwd) === "dashboard") return path.resolve(cwd, "..");
  return cwd;
}

export const REPO_ROOT = resolveRepoRoot();

export const VAULT_DIR = path.join(REPO_ROOT, "vault");
export const VAULT_PROJECTS_DIR = path.join(VAULT_DIR, "projects");
export const AGENTS_DIR = path.join(REPO_ROOT, "agents");
export const SKILLS_DIR = path.join(REPO_ROOT, "skills");

export const STATE_DIR = path.join(REPO_ROOT, ".agentic-os");
export const STATE_DB_PATH = path.join(STATE_DIR, "state.db");
export const SETTINGS_PATH = path.join(STATE_DIR, "settings.json");
export const MIGRATIONS_DIR = path.join(STATE_DIR, "migrations");

export function defaultWorkspaceRoot(): string {
  if (process.platform === "win32") {
    return path.join(os.homedir(), "code");
  }
  return path.join(os.homedir(), "code");
}
