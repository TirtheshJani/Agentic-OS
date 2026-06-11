# Feature Documentation Summary

Claude Control Center is a comprehensive management suite for Claude Code. Below is a summary of all developed features and links to their detailed documentation.

| Feature | Description | Detailed Doc |
|---|---|---|
| **Conversations** | Browse and search past Claude Code sessions across all projects. | [conversations.md](./conversations.md) |
| **Analytics & Codeburn** | Token usage charts, daily activity heatmaps, and cost estimates via Codeburn. | [analytics.md](./analytics.md) |
| **Memory Management** | View and edit global and project-scoped Claude memory entries. | [memory.md](./memory.md) |
| **Plans & Tasks** | Read, edit, and track progress on Claude Code plans and active tasks. | [plans.md](./plans.md) |
| **Settings & Config** | GUI for `settings.json`, hooks, rules, and `CLAUDE.md` files. | [settings.md](./settings.md) |
| **Managed Agents** | Create and interact with Anthropic Managed Agents via real-time SSE. | [managed-agents.md](./managed-agents.md) |
| **Agent Library** | A local registry for saving and reusing agent definitions as skills/subagents. | [managed-agents.md#agent-library](./managed-agents.md) |
| **Gemini Integration** | Manage Gemini CLI sessions, stats, and memory alongside Claude. | [gemini.md](./gemini.md) |
| **Git & GitHub** | Unified view of local repositories, commit activity, PRs, and issues. | [git-github.md](./git-github.md) |
| **Research Pipeline** | Automate information gathering from YouTube, Reddit, and the Web. | [research.md](./research.md) |
| **Obsidian Sync** | Use Obsidian vaults as knowledge sources for Memory RAG. | [obsidian.md](./obsidian.md) |
| **Usage Insights** | Human-readable reports on your Claude Code patterns and "Horizon". | [insights.md](./insights.md) |
| **Session History** | A flat, searchable log of all past Claude Code activity. | [history.md](./history.md) |
| **Codex CLI** | Browse Codex CLI sessions, memory, settings, and analytics. | [codex.md](./codex.md) |
| **Advisor Tracker** | Automatically detect and log `advisor()` tool calls across projects. | [advisor.md](./advisor.md) |
| **Routines** | View invocation history and statistics for scheduled skills. | [routines.md](./routines.md) |
| **Changelog** | Inline Claude Code release notes and "What's New" feed. | [changelog.md](./changelog.md) |
| **Health Monitor** | Detect broken references in skills, commands, hooks, and agents. | [health.md](./health.md) |
| **MCP Servers** | View configured Model Context Protocol servers. | [mcp-servers.md](./mcp-servers.md) |
| **QMD Runner** | Repo-local tool for organizing and running shell commands in markdown. | [../../qmd-runner.skill.README.md](../../qmd-runner.skill.README.md) |

---

## Core Capabilities

### Unified Interface
Instead of switching between multiple project directories and terminal windows, Claude Control Center brings all your Claude activity into a single, searchable web interface.

### Real-Time Updates
Using **Server-Sent Events (SSE)**, the dashboard stays in sync with your local activity. New messages, memory updates, and session changes appear instantly.

### Cost & Usage Visibility
The **Analytics** and **Codeburn** integration provides unprecedented insight into your usage patterns, helping you optimize your token spend and identify which projects or tasks are most resource-intensive.

### Configuration Health
The **Health Monitor** proactively identifies issues that would otherwise lead to silent failures or "invisible" skills, ensuring your Claude setup is robust and functional.
