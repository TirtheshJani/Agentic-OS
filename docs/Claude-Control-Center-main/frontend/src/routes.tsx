import type { ReactElement } from 'react';
import { DashboardPage } from './pages/DashboardPage';
import { ConversationsPage } from './pages/ConversationsPage';
import { SessionListPage } from './pages/SessionListPage';
import { MessageThreadPage } from './pages/MessageThreadPage';
import { MemoryPage } from './pages/MemoryPage';
import { ProjectMemoryPage } from './pages/ProjectMemoryPage';
import { PlansPage } from './pages/PlansPage';
import { TasksPage } from './pages/TasksPage';
import { SettingsPage } from './pages/SettingsPage';
import { HistoryPage } from './pages/HistoryPage';
import { CodexPage } from './pages/CodexPage';
import { AdvisorPage } from './pages/AdvisorPage';
import { AgentsPage } from './pages/AgentsPage';
import { AgentSessionPage } from './pages/AgentSessionPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { SemanticLayerPage } from './pages/SemanticLayerPage';
import { ChangelogPage } from './pages/ChangelogPage';
import { RoutinesPage } from './pages/RoutinesPage';
import { LoopsPage } from './pages/LoopsPage';
import { SchedulerPage } from './pages/SchedulerPage';
import { InsightsPage } from './pages/InsightsPage';
import { CodexCliSessionsPage } from './pages/CodexCliSessionsPage';
import { CodexCliSessionDetailPage } from './pages/CodexCliSessionDetailPage';
import { CodexCliSkillsPage } from './pages/CodexCliSkillsPage';
import { CodexCliSettingsPage } from './pages/CodexCliSettingsPage';
import { CodexCliMemoryPage } from './pages/CodexCliMemoryPage';
import { CodexCliAnalyticsPage } from './pages/CodexCliAnalyticsPage';
import { AgentLibraryPage } from './pages/AgentLibraryPage';
import { AgentBuilderPage } from './pages/AgentBuilderPage';
import { McpServersPage } from './pages/McpServersPage';
import { HooksPage } from './pages/HooksPage';
import { RulesPage } from './pages/RulesPage';
import { ClaudeMdPage } from './pages/ClaudeMdPage';
import { HealthPage } from './pages/HealthPage';
import { WorkspacePage } from './pages/WorkspacePage';
import { GeminiPage } from './pages/GeminiPage';
import { GeminiSessionsPage } from './pages/GeminiSessionsPage';
import { GeminiSessionDetailPage } from './pages/GeminiSessionDetailPage';
import { GeminiSkillsPage } from './pages/GeminiSkillsPage';
import { GeminiSettingsPage } from './pages/GeminiSettingsPage';
import { GeminiMemoryPage } from './pages/GeminiMemoryPage';
import { GeminiAnalyticsPage } from './pages/GeminiAnalyticsPage';
import { ObsidianPage } from './pages/ObsidianPage';
import { ObsidianVaultPage } from './pages/ObsidianVaultPage';
import { NewsPage } from './pages/NewsPage';
import { ResearchPage } from './pages/ResearchPage';
import { VideoResearchPage } from './pages/VideoResearchPage';
import { GithubPage } from './pages/GithubPage';
import { DockerPage } from './pages/DockerPage';
import { AgentViewPage } from './pages/AgentViewPage';
import { AntigravitySessionsPage } from './pages/AntigravitySessionsPage';
import { AntigravitySessionDetailPage } from './pages/AntigravitySessionDetailPage';
import { AntigravitySkillsPage } from './pages/AntigravitySkillsPage';
import { AntigravitySettingsPage } from './pages/AntigravitySettingsPage';
import { AntigravityMemoryPage } from './pages/AntigravityMemoryPage';
import { GitTreePage } from './pages/GitTreePage';
import { GoalMonitorPage } from './pages/GoalMonitorPage';
import { EvalsPage } from './pages/EvalsPage';
import { CachePage } from './pages/CachePage';
import { InvoicingPage } from './pages/InvoicingPage';
import { CrmPage } from './pages/CrmPage';

export const routePaths = {
  dashboard: '/dashboard',
  conversations: '/conversations',
  conversationProject: '/conversations/:projectId',
  conversationThread: '/conversations/:projectId/:sessionId',
  memory: '/memory',
  projectMemory: '/memory/:projectId',
  plans: '/plans',
  planDetail: '/plans/:slug',
  tasks: '/tasks',
  settings: '/settings',
  history: '/history',
  codex: '/codex',
  advisor: '/advisor',
  agents: '/agents',
  agentSession: '/agents/sessions/:sessionId',
  analytics: '/analytics',
  semanticLayer: '/semantic-layer',
  changelog: '/changelog',
  routines: '/routines',
  loops: '/loops',
  scheduler: '/scheduler',
  insights: '/insights',
  codexSessions: '/codex-sessions',
  codexSessionDetail: '/codex-sessions/:sessionId',
  codexSkills: '/codex-skills',
  codexSettings: '/codex-settings',
  codexMemory: '/codex-memory',
  codexAnalytics: '/codex-analytics',
  agentLibrary: '/agent-library',
  newAgent: '/agent-library/new',
  editAgent: '/agent-library/:id/edit',
  mcpServers: '/mcp-servers',
  hooks: '/hooks',
  rules: '/rules',
  claudeMd: '/claude-md',
  health: '/health',
  workspace: '/workspace',
  gemini: '/gemini',
  geminiSessions: '/gemini-sessions',
  geminiSessionDetail: '/gemini-sessions/:sessionId',
  geminiSkills: '/gemini-skills',
  geminiSettings: '/gemini-settings',
  geminiMemory: '/gemini-memory',
  geminiAnalytics: '/gemini-analytics',
  obsidian: '/obsidian',
  obsidianVault: '/obsidian/:vaultId',
  news: '/news',
  research: '/research',
  videoResearch: '/video-research',
  github: '/github',
  docker: '/docker',
  agentView: '/agent-view',
  antigravitySessions: '/antigravity-sessions',
  antigravitySessionDetail: '/antigravity-sessions/:id',
  antigravitySkills: '/antigravity-skills',
  antigravitySettings: '/antigravity-settings',
  antigravityMemory: '/antigravity-memory',
  gitTree: '/git-tree',
  evals: '/evals',
  goalMonitor: '/goals',
  invoicing: '/invoicing',
  crm: '/crm',
  cacheHealth: '/cache',
} as const;

export const defaultRoute = routePaths.dashboard;

interface AppRoute {
  path: string;
  element: ReactElement;
}

export const appRoutes: AppRoute[] = [
  { path: routePaths.dashboard, element: <DashboardPage /> },
  { path: routePaths.conversations, element: <ConversationsPage /> },
  { path: routePaths.conversationProject, element: <SessionListPage /> },
  { path: routePaths.conversationThread, element: <MessageThreadPage /> },
  { path: routePaths.memory, element: <MemoryPage /> },
  { path: routePaths.projectMemory, element: <ProjectMemoryPage /> },
  { path: routePaths.plans, element: <PlansPage /> },
  { path: routePaths.planDetail, element: <PlansPage /> },
  { path: routePaths.tasks, element: <TasksPage /> },
  { path: routePaths.settings, element: <SettingsPage /> },
  { path: routePaths.history, element: <HistoryPage /> },
  { path: routePaths.codex, element: <CodexPage /> },
  { path: routePaths.advisor, element: <AdvisorPage /> },
  { path: routePaths.agents, element: <AgentsPage /> },
  { path: routePaths.agentSession, element: <AgentSessionPage /> },
  { path: routePaths.analytics, element: <AnalyticsPage /> },
  { path: routePaths.semanticLayer, element: <SemanticLayerPage /> },
  { path: routePaths.changelog, element: <ChangelogPage /> },
  { path: routePaths.routines, element: <RoutinesPage /> },
  { path: routePaths.loops, element: <LoopsPage /> },
  { path: routePaths.scheduler, element: <SchedulerPage /> },
  { path: routePaths.insights, element: <InsightsPage /> },
  { path: routePaths.codexSessions, element: <CodexCliSessionsPage /> },
  { path: routePaths.codexSessionDetail, element: <CodexCliSessionDetailPage /> },
  { path: routePaths.codexSkills, element: <CodexCliSkillsPage /> },
  { path: routePaths.codexSettings, element: <CodexCliSettingsPage /> },
  { path: routePaths.codexMemory, element: <CodexCliMemoryPage /> },
  { path: routePaths.codexAnalytics, element: <CodexCliAnalyticsPage /> },
  { path: routePaths.agentLibrary, element: <AgentLibraryPage /> },
  { path: routePaths.newAgent, element: <AgentBuilderPage /> },
  { path: routePaths.editAgent, element: <AgentBuilderPage /> },
  { path: routePaths.mcpServers, element: <McpServersPage /> },
  { path: routePaths.hooks, element: <HooksPage /> },
  { path: routePaths.rules, element: <RulesPage /> },
  { path: routePaths.claudeMd, element: <ClaudeMdPage /> },
  { path: routePaths.health, element: <HealthPage /> },
  { path: routePaths.workspace, element: <WorkspacePage /> },
  { path: routePaths.gemini, element: <GeminiPage /> },
  { path: routePaths.geminiSessions, element: <GeminiSessionsPage /> },
  { path: routePaths.geminiSessionDetail, element: <GeminiSessionDetailPage /> },
  { path: routePaths.geminiSkills, element: <GeminiSkillsPage /> },
  { path: routePaths.geminiSettings, element: <GeminiSettingsPage /> },
  { path: routePaths.geminiMemory, element: <GeminiMemoryPage /> },
  { path: routePaths.geminiAnalytics, element: <GeminiAnalyticsPage /> },
  { path: routePaths.obsidian, element: <ObsidianPage /> },
  { path: routePaths.obsidianVault, element: <ObsidianVaultPage /> },
  { path: routePaths.news, element: <NewsPage /> },
  { path: routePaths.research, element: <ResearchPage /> },
  { path: routePaths.videoResearch, element: <VideoResearchPage /> },
  { path: routePaths.github, element: <GithubPage /> },
  { path: routePaths.docker, element: <DockerPage /> },
  { path: routePaths.agentView, element: <AgentViewPage /> },
  { path: routePaths.antigravitySessions, element: <AntigravitySessionsPage /> },
  { path: routePaths.antigravitySessionDetail, element: <AntigravitySessionDetailPage /> },
  { path: routePaths.antigravitySkills, element: <AntigravitySkillsPage /> },
  { path: routePaths.antigravitySettings, element: <AntigravitySettingsPage /> },
  { path: routePaths.antigravityMemory, element: <AntigravityMemoryPage /> },
  { path: routePaths.gitTree, element: <GitTreePage /> },
  { path: routePaths.goalMonitor, element: <GoalMonitorPage /> },
  { path: routePaths.evals, element: <EvalsPage /> },
  { path: routePaths.invoicing, element: <InvoicingPage /> },
  { path: routePaths.crm, element: <CrmPage /> },
  { path: routePaths.cacheHealth, element: <CachePage /> },
];
