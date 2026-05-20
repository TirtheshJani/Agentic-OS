import { normalizeCwd, repoRoot, vaultPath } from "./paths";
import { loadTeams, type Team } from "./teams";

// loadTeams() walks projects + discovered repos on every call. isCwdAllowed
// runs in the hot path of every /api/run request, so we cache the team list
// for a short window. 5s is short enough that newly-added projects show up
// quickly during development; if a test needs deterministic invalidation it
// can clear AGENTIC_OS_TEAMS_CACHE_MS or reach into the module under test.
const TEAMS_CACHE_TTL_MS = 5_000;
let _cachedTeams: { teams: Team[]; expiresAt: number } | null = null;

function getTeamsCached(): Team[] {
  const now = Date.now();
  if (_cachedTeams && _cachedTeams.expiresAt > now) return _cachedTeams.teams;
  const teams = loadTeams();
  _cachedTeams = { teams, expiresAt: now + TEAMS_CACHE_TTL_MS };
  return teams;
}

export function isCwdAllowed(cwd: string): boolean {
  const target = normalizeCwd(cwd);
  if (target === normalizeCwd(repoRoot)) return true;
  if (target === normalizeCwd(vaultPath)) return true;
  for (const t of getTeamsCached()) {
    if (!t.pathExists) continue;
    if (normalizeCwd(t.path) === target) return true;
  }
  return false;
}
