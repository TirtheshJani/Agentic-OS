// ---------------------------------------------------------------------------
// Goal Monitor
// ---------------------------------------------------------------------------

export type GoalStatus = 'active' | 'paused' | 'completed' | 'cleared';

export interface GoalMilestone {
  id: string;
  text: string;
  completed: boolean;
  createdAt: string;
}

export interface Goal {
  id: string;
  text: string;
  status: GoalStatus;
  createdAt: string;
  updatedAt: string;
  milestones: GoalMilestone[];
  progress: number;
}

export interface SessionGoalSummary {
  projectId: string;
  sessionId: string;
  sessionSlug: string | null;
  cwd: string | null;
  lastMessageAt: string | null;
  goals: Goal[];
}

// ---------------------------------------------------------------------------
// Evals
// ---------------------------------------------------------------------------

export interface EvalRubricEntry {
  score: number;
  reason: string;
}

export interface EvalJudge {
  prompt_clarity: EvalRubricEntry;
  token_efficiency: EvalRubricEntry;
  agent_accuracy: EvalRubricEntry;
  code_elegance: EvalRubricEntry;
  status: string;
}

export interface EvalGitInfo {
  repo: string | null;
  commits: Array<{ hash: string; author: string; date: string; subject: string }>;
  commit_count: number;
  files_changed: number;
  insertions: number;
  deletions: number;
}

export interface EvalStaticInfo {
  ts_errors: number | null;
  pylint_errors: number | null;
  available_tools: string[];
}

export interface EvalResult {
  session_id: string;
  tool: 'claude' | 'codex' | string;
  project: string;
  cwd: string;
  first_ts: string;
  last_ts: string;
  task_category: string;
  graded_at: string;
  composite_score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  token_efficiency: { score: number; details: Record<string, unknown> };
  code_quality: { score: number; details: Record<string, unknown> };
  coherence: { score: number; details: Record<string, unknown> };
  judge: EvalJudge;
  git: EvalGitInfo;
  static: EvalStaticInfo;
  repo_override: string | null;
  status: 'done' | 'pending' | 'error';
}

export interface EvalStats {
  total: number;
  graded: number;
  avg_score: number;
  grade_distribution: Record<string, number>;
  by_tool: Record<string, { avg_score: number; count: number }>;
  trend: Array<{ date: string; avg_score: number; count: number }>;
  flagged: EvalResult[];
  period_days: number | null;
}

export interface EvalBudget {
  date: string;
  spent_usd: number;
  limit_usd: number;
  remaining_usd: number;
  exhausted: boolean;
}

export interface EvalSessionsResponse {
  sessions: EvalResult[];
  total: number;
  page: number;
  limit: number;
  stats: EvalStats;
}

// ---------------------------------------------------------------------------
// Git Tree + Worktree
// ---------------------------------------------------------------------------

export type CommitAttribution = 'claude' | 'codex' | 'user' | 'unknown';

export interface GitCommit {
  hash: string;
  shortHash: string;
  subject: string;
  authorName: string;
  authorEmail: string;
  committedAt: string;
  refs: string[];
  parents: string[];
  body: string;
  attribution: CommitAttribution;
  attributionSources: string[];
  coAuthors: string[];
}

export interface GitWorktree {
  path: string;
  branch: string | null;
  headHash: string;
  isMain: boolean;
  isDetached: boolean;
  isLocked: boolean;
  lockReason?: string | null;
  prunable: boolean;
  isBare: boolean;
}

export interface GitWorktreeWithRepo extends GitWorktree {
  repoId: string;
  repoName: string;
}

export interface GitRepo {
  id: string;
  name: string;
  path: string;
  rootId?: string;
}

// ---------------------------------------------------------------------------

export interface DockerStack {
  name: string;
  status: string;
  configFiles: string;
}

export interface DockerService {
  name: string;
  service: string;
  state: string;
  status: string;
  health: string;
  ports: string;
}

export interface DockerActionResult {
  returncode: number;
  stdout: string;
  stderr: string;
}

export interface DockerLogsResult {
  logs: string;
  stderr: string;
  returncode: number;
}

export interface InsightsStat    { label: string; value: string }
export interface InsightsBar     { label: string; value: number; pct: number }
export interface InsightsChart   { title: string; bars: InsightsBar[] }
export interface InsightsFeature { title: string; oneliner: string; why: string; examples: { desc: string; code: string }[] }
export interface InsightsPattern { title: string; summary: string; detail: string; prompt: string }
export interface InsightsHorizon { title: string; possible: string; tip: string; prompt: string }
export interface InsightsData {
  date_range: string;
  report_date: string;
  stats: InsightsStat[];
  charts: InsightsChart[];
  features: InsightsFeature[];
  patterns: InsightsPattern[];
  horizon: InsightsHorizon[];
}

export interface Project {
  id: string;
  displayName: string;
  fullPath: string;
  sessionCount: number;
  lastActivity: string | null;
  hasMemory: boolean;
  avgQualityScore: number | null;
  qualityTier: 'high' | 'medium' | 'low' | null;
}

export interface Session {
  sessionId: string;
  messageCount: number;
  firstMessageAt: string | null;
  lastMessageAt: string | null;
  cwd: string | null;
  gitBranch: string | null;
  version: string | null;
  slug: string | null;
  hasSubagents: boolean;
}

export interface ContentBlock {
  type: 'text' | 'tool_use' | 'tool_result' | 'server_tool_use' | 'advisor_tool_result';
  text?: string;
  id?: string;
  name?: string;
  input?: unknown;
  tool_use_id?: string;
  content?: string | ContentBlock[];
  is_error?: boolean;
  model?: string;
  error?: string;
}

export interface Message {
  uuid: string;
  parentUuid: string | null;
  type: 'user' | 'assistant';
  role: string;
  content: ContentBlock[];
  timestamp: string;
  isSidechain: boolean;
  agentId: string | null;
  isMeta: boolean;
  sessionId: string;
  cwd: string | null;
  gitBranch: string | null;
  version: string | null;
  slug: string | null;
  model: string | null;
  usage: Record<string, number> | null;
  stopReason: string | null;
}

export interface SessionMessages {
  session: {
    cwd: string;
    gitBranch: string;
    version: string;
    sessionId: string;
    slug: string;
  };
  messages: Message[];
  subagentIds: string[];
}

export interface SubagentMeta {
  agentType?: string;
  description?: string;
}

export interface SubagentData {
  meta: SubagentMeta;
  messages: Message[];
}

export interface MemoryFile {
  filename: string;
  name: string;
  description: string;
  type: string;
  body: string;
  path: string;
}

export interface MemoryFileDetail {
  filename: string;
  frontmatter: {
    name: string;
    description: string;
    type: string;
  };
  body: string;
}

export interface Plan {
  slug: string;
  title: string;
  preview: string;
  modifiedAt: number;
}

export interface PlanDetail {
  slug: string;
  title: string;
  raw: string;
  modifiedAt: number;
}

export interface ActiveSession {
  pid: number;
  sessionId: string;
  cwd: string;
  startedAt: number;
  kind: string;
  entrypoint: string;
  isAlive: boolean;
  additionalMcpServers: number;
  bridgeSessionId?: string;
}

export interface Plugin {
  id: string;
  name: string;
  marketplace: string;
  scope: string;
  version: string;
  installedAt: string;
  lastUpdated: string;
  isEnabled: boolean;
  estimatedContextTokens?: number | null;
}

export interface Command {
  filename: string;
  name: string;
  description: string;
  argumentHint: string;
  allowedTools: string[];
  body: string;
}

export interface Skill {
  id: string;
  name: string;
  description: string;
  originType: 'agent-marketplace' | 'local';
  originLabel: string;
}

export interface HistoryItem {
  display: string;
  timestamp: number;
  project: string;
  sessionId: string;
}

export interface Task {
  uuid: string;
  hasLock: boolean;
  highwatermark: string | null;
}

// ---------------------------------------------------------------------------
// Managed Agents
// ---------------------------------------------------------------------------

export interface AgentTool {
  type: string;
  name: string;
  description?: string;
}

export interface McpServer {
  name: string;
  url: string;
}

export interface ManagedAgent {
  id: string;
  name: string;
  model: string;
  system: string;
  tools: AgentTool[];
  mcp_servers: McpServer[];
  created_at: string;
  updated_at: string;
}

export interface AgentEnvironment {
  id: string;
  name: string;
  packages: string[];
  network_access: boolean;
  files: { path: string; content: string }[];
  created_at: string;
}

export interface AgentSession {
  id: string;
  agent_id: string;
  environment_id: string;
  status: 'starting' | 'running' | 'stopped' | 'error';
  created_at: string;
  last_event_at: string | null;
}

export interface AgentEvent {
  event: string;
  data: unknown;
  timestamp?: string;
}

// Phase 4 — GitHub / Git integration
export interface GithubRoot {
  id: string;
  name: string;
  path: string;
  enabled: boolean;
}

export interface DiscoveredRepo {
  id: string;
  root_id: string;
  name: string;
  path: string;
  remote_url: string | null;
  remote_owner: string | null;
  remote_repo: string | null;
  current_branch: string | null;
  dirty: boolean;
  ahead: number;
  behind: number;
  last_commit_at: string | null;
}

export interface GithubPR {
  id: number;
  number: number;
  title: string;
  html_url: string;
  repo_full_name: string;
  state: string;
  draft: boolean;
  created_at: string;
  updated_at: string;
  labels: string[];
}

export interface GithubIssue {
  id: number;
  number: number;
  title: string;
  html_url: string;
  repo_full_name: string;
  created_at: string;
  updated_at: string;
  labels: string[];
  milestone: string | null;
}

export interface GithubMilestone {
  id: number;
  number: number;
  title: string;
  html_url: string;
  repo_full_name: string;
  due_on: string | null;
  open_issues: number;
  description: string;
}

export interface LocalBranch {
  name: string;
  upstream: string | null;
  is_current: boolean;
  short_hash: string;
  is_remote: boolean;
}

export interface CommitActivity {
  hash: string;
  repo: string;
  repo_path: string;
  author_name: string;
  author_email: string;
  timestamp: string;
  subject: string;
}

export interface GithubStatus {
  token_configured: boolean;
  github_auth: boolean;
  github_login: string | null;
  rate_limit: { remaining: number; limit: number; reset: number } | null;
  snapshot_age_seconds: number | null;
  snapshot_refreshed_at: string | null;
}

export interface GithubPRsResponse {
  github_auth: boolean;
  items: GithubPR[];
  total_count: number;
}

export interface GithubIssuesResponse {
  github_auth: boolean;
  items: GithubIssue[];
  total_count: number;
}

export interface GithubMilestonesResponse {
  github_auth: boolean;
  items: GithubMilestone[];
}

// ---------------------------------------------------------------------------
// MCP Servers
// ---------------------------------------------------------------------------

export interface McpServerConfig {
  name: string;
  // stdio
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  // stdio / sse / http
  type?: 'stdio' | 'sse' | 'http';
  url?: string;
  headers?: Record<string, string>;
  toolCount?: number | null;
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export interface HookHandler {
  type: 'command';
  command: string;
}

export interface HookEntry {
  matcher: string;
  hooks: HookHandler[];
}

export type HookEvent = 'PreToolUse' | 'PostToolUse' | 'Stop' | 'Notification';

export type HooksData = Record<HookEvent, HookEntry[]>;

// ---------------------------------------------------------------------------
// Rules / Permissions
// ---------------------------------------------------------------------------

export interface RulesData {
  allow: string[];
  deny: string[];
}

// ---------------------------------------------------------------------------
// CLAUDE.md
// ---------------------------------------------------------------------------

export interface ClaudeMdFile {
  id: string;
  scope: 'global' | 'project';
  label: string;
  path: string;
  projectName?: string;
}

// ---------------------------------------------------------------------------
// Health / Reference detection
// ---------------------------------------------------------------------------

export interface HealthIssue {
  type: 'skill' | 'command' | 'agent_library' | 'hook';
  resource: string;
  brokenRef: string;
  hint: string;
}

// ---------------------------------------------------------------------------
// Model A/B Bench
// ---------------------------------------------------------------------------

export interface BenchEntry {
  label: string;            // opaque handle (A/B/C…); stable per run
  model?: string;           // hidden in a blind run until revealed
  provider?: string;        // hidden in a blind run until revealed
  text: string;
  input_tokens: number;
  output_tokens: number;
  latency_ms: number;
  cost_usd: number;
  error: string | null;
}

export interface BenchRun {
  id: string;
  created_at: string;
  prompt: string;
  blind: boolean;
  entries: BenchEntry[];
  vote: string | null;      // winning label
  revealed: boolean;
}

export interface BenchRunsResponse {
  runs: BenchRun[];
  total: number;
  page: number;
  limit: number;
}

export interface BenchBudget {
  day: string;
  spent_usd: number;
  limit_usd: number;
  remaining_usd: number;
  exhausted: boolean;
}

// provider -> whether its API key is configured
export type BenchProviders = Record<string, boolean>;
