export type DeptKey =
  | "research"
  | "coding"
  | "content"
  | "business"
  | "productivity"
  | "infra";

export type Department = {
  label: string;
  color: string;
  glyph: string;
};

export const DEPARTMENTS: Record<DeptKey, Department> = {
  research:     { label: "Research",     color: "var(--dept-research)",     glyph: "Σ" },
  coding:       { label: "Coding",       color: "var(--dept-coding)",       glyph: "{}" },
  content:      { label: "Content",      color: "var(--dept-content)",      glyph: "¶" },
  business:     { label: "Business",     color: "var(--dept-business)",     glyph: "$" },
  productivity: { label: "Productivity", color: "var(--dept-productivity)", glyph: "✓" },
  infra:        { label: "Infra",        color: "var(--dept-infra)",        glyph: "⚙" },
};

export type AgentKind = "human" | "agent";

export type Agent = {
  handle: string;
  name: string;
  kind: AgentKind;
  initials: string;
  color: string;
  dept: DeptKey | null;
};

export type Skill = {
  name: string;
  family: string;
  status: "authored" | "stub";
  cadence: string | null;
  runs: number;
  lastRun: string;
};

export type Project = {
  slug: string;
  name: string;
  dept: DeptKey;
  active: boolean;
  open: number;
  color: string;
};

export type IssueStatus =
  | "backlog"
  | "queued"
  | "claimed"
  | "running"
  | "review"
  | "done"
  | "failed";

export type Priority = "urgent" | "high" | "medium" | "low";

export type LiveState = {
  tokensPerSec: number;
  started: string;
  tool: string;
};

export type Issue = {
  id: string;
  title: string;
  desc: string;
  status: IssueStatus;
  priority: Priority | null;
  dept: DeptKey;
  skill: string | null;
  assignee: string | null;
  reporter: string;
  labels: string[];
  created: string;
  updated: string;
  cost: number;
  tokensIn: number;
  tokensOut: number;
  live?: LiveState;
  error?: string;
};

export type ColumnDef = {
  key: Exclude<IssueStatus, "claimed" | "failed">;
  label: string;
  color: string;
  glyph: string;
  blurb: string;
};

export const COLUMNS: ColumnDef[] = [
  { key: "backlog", label: "Backlog", color: "var(--status-backlog)", glyph: "○", blurb: "Triaged but not yet planned." },
  { key: "queued",  label: "Queued",  color: "var(--status-queued)",  glyph: "◐", blurb: "Ready for an agent or runner to pick up." },
  { key: "running", label: "Running", color: "var(--status-running)", glyph: "●", blurb: "An agent is currently working." },
  { key: "review",  label: "Review",  color: "var(--status-review)",  glyph: "◆", blurb: "Awaiting human sign-off." },
  { key: "done",    label: "Done",    color: "var(--status-done)",    glyph: "✓", blurb: "Shipped or merged." },
];

export type PriorityDef = {
  label: string;
  color: string;
  rank: number;
  bars: number;
};

export const PRIORITIES: Record<Priority, PriorityDef> = {
  urgent:  { label: "Urgent",  color: "var(--urgent)", rank: 4, bars: 4 },
  high:    { label: "High",    color: "var(--warn)",   rank: 3, bars: 3 },
  medium:  { label: "Medium",  color: "var(--ember)",  rank: 2, bars: 2 },
  low:     { label: "Low",     color: "var(--low)",    rank: 1, bars: 1 },
};

export type RecentRun = {
  id: string;
  skill: string;
  agent: string;
  status: "running" | "done";
  duration: string;
  cost: number;
  started: string;
  issue: string | null;
};

export type VaultItem = {
  path: string;
  kind: "raw" | "wiki" | "thread" | "output";
  changed: string;
};

export type ActivityEntry = {
  kind:
    | "create"
    | "comment"
    | "assign"
    | "label"
    | "status"
    | "run-start"
    | "run-tick"
    | "tool";
  who: string;
  when: string;
  text: string;
  run?: string;
};

export type HeroMetrics = {
  runningAgents: number;
  burn24h: number;
  tokens24h: number;
  runsToday: number;
};

export type RunningAgent = {
  taskId: number;
  runId: number | null;
  agent: string | null;
  title: string;
  costSoFar: number;
  tokensIn: number;
  tokensOut: number;
  startedAtIso: string | null;
};

export type OpenIssueCount = {
  slug: string;
  name: string;
  open: number;
};

export type DashboardData = {
  heroMetrics: HeroMetrics;
  runningAgents: RunningAgent[];
  recentRuns: RecentRun[];
  vaultRecents: VaultItem[];
  openIssueCounts: OpenIssueCount[];
  projects: Project[];
};

export type IssueDetail = {
  issue: Issue;
  labels: string[];
  recentRuns: RecentRun[];
  threadBody: string;
  projectSlug: string | null;
  // Resolved from the assignee's agent profile (`default-repo` frontmatter).
  // null when assignee is `user` or the agent has no default-repo. Consumed
  // by IssueLaunchButtons to gate the "Open in terminal" action.
  defaultRepo: string | null;
};

export type InboxItem = {
  kind: "vault" | "failed-run" | "backlog-task";
  id: string;
  title: string;
  subtitle: string | null;
  tsIso: string;
  href: string | null;
};
