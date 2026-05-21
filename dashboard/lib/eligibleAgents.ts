// dashboard/lib/eligibleAgents.ts
export function isEligible(projectCapabilities: string[], agentSkills: string[]): boolean {
  if (projectCapabilities.length === 0) return true;
  return agentSkills.some(s => projectCapabilities.includes(s));
}

interface AgentLike {
  skills: string[];
}

export function filterEligible<T extends AgentLike>(agents: T[], projectCapabilities: string[]): T[] {
  return agents.filter(a => isEligible(projectCapabilities, a.skills));
}
