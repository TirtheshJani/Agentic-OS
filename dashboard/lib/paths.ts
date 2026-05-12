import path from "node:path";

export const repoRoot = path.resolve(process.cwd(), "..");
export const skillsPath = path.join(repoRoot, "skills");
export const vaultPath = process.env.VAULT_PATH
  ? path.resolve(repoRoot, process.env.VAULT_PATH)
  : path.join(repoRoot, "vault");
export const automationsRemotePath = path.join(repoRoot, "automations", "remote");
export const dbPath = process.env.AGENTIC_OS_DB
  ? path.resolve(repoRoot, process.env.AGENTIC_OS_DB)
  : path.join(repoRoot, ".agentic-os", "state.db");

export function normalizeCwd(p: string): string {
  return path.resolve(p).toLowerCase();
}
