import { normalizeCwd, repoRoot, vaultPath } from "./paths";
import { loadTeams } from "./teams";

export function isCwdAllowed(cwd: string): boolean {
  const target = normalizeCwd(cwd);
  if (target === normalizeCwd(repoRoot)) return true;
  if (target === normalizeCwd(vaultPath)) return true;
  for (const t of loadTeams()) {
    if (!t.pathExists) continue;
    if (normalizeCwd(t.path) === target) return true;
  }
  return false;
}
