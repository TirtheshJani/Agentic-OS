export type AgentCapability = 'web_search' | 'code_exec' | 'cli' | 'memory';
export type InstallTarget = 'skill' | 'subagent';

export interface AgentDefinition {
  id: string;
  name: string;
  slug: string;
  description: string;
  system_prompt: string;
  capabilities: AgentCapability[];
  cli_tools: string[];
  install_targets: InstallTarget[];
  source_session_ids: string[];
  installed_skill: boolean;
  installed_subagent: boolean;
  created_at: string;
  updated_at: string;
}

export interface AgentPreview {
  skill_md: string;
  subagent_md: string;
}

export interface InstallResult {
  ok: boolean;
  installed: InstallTarget[];
  errors?: string[];
  agent: AgentDefinition;
}
