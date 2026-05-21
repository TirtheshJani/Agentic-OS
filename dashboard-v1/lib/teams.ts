import { loadDiscoveredRepos } from "./repo-discovery";
import { normalizeCwd } from "./paths";
import { loadProjects, type Project } from "./projects-loader";

export type TeamSource = "project" | "discovery";

export type Team = {
  slug: string;
  name: string;
  path: string;
  description: string;
  capabilities: string[];
  agent: string | null;
  localAgents: string[];
  localSkills: string[];
  source: TeamSource;
  pathExists: boolean;
  project: Project | null;
};

function projectToTeam(p: Project): Team {
  return {
    slug: p.slug,
    name: p.name,
    path: p.path,
    description: p.description,
    capabilities: p.capabilities,
    agent: p.agent,
    localAgents: [],
    localSkills: [],
    source: "project",
    pathExists: p.pathExists,
    project: p,
  };
}

export function loadTeams(): Team[] {
  const projects = loadProjects();
  const projectsByPath = new Map(
    projects.map((p) => [normalizeCwd(p.path), p])
  );
  const teams: Team[] = projects.map(projectToTeam);
  const teamSlugs = new Set(teams.map((t) => t.slug));

  for (const repo of loadDiscoveredRepos()) {
    const key = normalizeCwd(repo.path);
    if (projectsByPath.has(key)) continue;
    let slug = repo.slug;
    let i = 2;
    while (teamSlugs.has(slug)) {
      slug = `${repo.slug}-${i++}`;
    }
    teamSlugs.add(slug);
    teams.push({
      slug,
      name: repo.name,
      path: repo.path,
      description: repo.summary,
      capabilities: [],
      agent: null,
      localAgents: repo.localAgents,
      localSkills: repo.localSkills,
      source: "discovery",
      pathExists: true,
      project: null,
    });
  }

  return teams.sort((a, b) => a.name.localeCompare(b.name));
}

export function teamBySlug(slug: string): Team | null {
  return loadTeams().find((t) => t.slug === slug) ?? null;
}

export function teamByPath(p: string): Team | null {
  const target = normalizeCwd(p);
  return loadTeams().find((t) => normalizeCwd(t.path) === target) ?? null;
}
