import fs from "node:fs";
import path from "node:path";
import { vaultPath } from "./paths";

// Cross-repo shared memory layer. Spawned sessions in any repo can read and
// write here so context flows between teams. Layout:
//   <vault>/shared/global/        — facts that apply across all repos
//   <vault>/shared/repos/<slug>/  — per-team scratchpad
//
// Override the root with AGENTIC_OS_SHARED_VAULT (must be an existing dir or
// creatable). Default lives inside the Agentic-OS vault so it travels with
// the repo via git.
export const sharedVaultRoot = process.env.AGENTIC_OS_SHARED_VAULT
  ? path.resolve(process.env.AGENTIC_OS_SHARED_VAULT)
  : path.join(vaultPath, "shared");

export function ensureSharedVault(): void {
  fs.mkdirSync(path.join(sharedVaultRoot, "global"), { recursive: true });
  fs.mkdirSync(path.join(sharedVaultRoot, "repos"), { recursive: true });
}

export function repoVaultPath(slug: string): string {
  const dir = path.join(sharedVaultRoot, "repos", slug);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function sharedVaultEnv(slug: string | null): Record<string, string> {
  ensureSharedVault();
  const env: Record<string, string> = {
    AGENTIC_OS_VAULT_SHARED: sharedVaultRoot,
    AGENTIC_OS_VAULT_GLOBAL: path.join(sharedVaultRoot, "global"),
  };
  if (slug) env.AGENTIC_OS_VAULT_REPO = repoVaultPath(slug);
  return env;
}

export function sharedVaultSystemPrompt(slug: string | null): string {
  const globalDir = path.join(sharedVaultRoot, "global");
  const repoDir = slug ? repoVaultPath(slug) : null;
  const lines = [
    "Cross-repo shared memory is available via the Agentic OS vault:",
    `- Global facts (apply across repos): ${globalDir}`,
  ];
  if (repoDir) {
    lines.push(`- This team's scratchpad: ${repoDir}`);
  }
  lines.push(
    "Write durable cross-cutting notes there as markdown so other repos' sessions can read them. Do not write secrets."
  );
  return lines.join("\n");
}
