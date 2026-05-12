import { normalizeCwd, repoRoot, vaultPath } from "./paths";
import { loadProjects } from "./projects-loader";

export function isCwdAllowed(cwd: string): boolean {
  const target = normalizeCwd(cwd);
  if (target === normalizeCwd(repoRoot)) return true;
  if (target === normalizeCwd(vaultPath)) return true;
  for (const p of loadProjects()) {
    if (!p.pathExists) continue;
    if (normalizeCwd(p.path) === target) return true;
  }
  return false;
}
