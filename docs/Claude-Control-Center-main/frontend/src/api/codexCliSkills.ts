import { apiFetch } from './client';

export interface CodexCliSkill {
  id: string;
  name: string;
  description: string;
  short_description: string;
  has_agent: boolean;
  agent_display_name: string | null;
  agent_short_description: string | null;
  icon_small: string | null;
  icon_large: string | null;
  has_scripts: boolean;
  has_assets: boolean;
}

export interface CodexCliSkillDetail extends CodexCliSkill {
  body: string;
}

export const fetchCodexCliSkills = (): Promise<CodexCliSkill[]> =>
  apiFetch<CodexCliSkill[]>('/api/codex-cli/skills');

export const fetchCodexCliSystemSkills = (): Promise<CodexCliSkill[]> =>
  apiFetch<CodexCliSkill[]>('/api/codex-cli/skills/system');

export const fetchCodexCliSkill = (skillId: string): Promise<CodexCliSkillDetail> =>
  apiFetch<CodexCliSkillDetail>(`/api/codex-cli/skills/${skillId}`);

export const fetchCodexCliSkillAgent = (skillId: string): Promise<Record<string, unknown>> =>
  apiFetch<Record<string, unknown>>(`/api/codex-cli/skills/${skillId}/agent`);
