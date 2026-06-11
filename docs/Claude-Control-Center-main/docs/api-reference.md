# REST API Reference — Claude Control Center

All endpoints are served by the Flask backend on port `5050` (default). In development, the Vite dev server proxies `/api/*` requests from port `5173`.

## Conventions

- All routes are prefixed with `/api/`.
- Request and response bodies are JSON.
- All mutating requests (`POST`, `PUT`, `DELETE`, `PATCH`) must include the header `X-Requested-With: XMLHttpRequest`. The backend rejects requests without it with `403 Forbidden`.
- Error responses return `{"error": "<message>"}` with an appropriate HTTP status code.
- Timestamps are ISO 8601 strings.

---

## Projects

### `GET /api/projects`

List all Claude Code projects found in `~/.claude/projects/`.

**Response**
```json
[
  {
    "id": "abc123",
    "name": "my-project",
    "path": "/home/user/code/my-project",
    "sessionCount": 12,
    "lastActive": "2026-04-20T10:30:00Z"
  }
]
```

---

## Conversations

### `GET /api/sessions/:projectId`

List all conversation sessions for a project.

**Response**
```json
[
  {
    "sessionId": "sess_abc",
    "projectId": "abc123",
    "startTime": "2026-04-20T10:00:00Z",
    "messageCount": 42,
    "model": "claude-sonnet-4-6"
  }
]
```

### `GET /api/sessions/:projectId/:sessionId`

Retrieve the full message thread for a session.

**Response**
```json
[
  {
    "uuid": "msg_001",
    "parentUuid": null,
    "type": "human",
    "role": "user",
    "content": [
      { "type": "text", "text": "Hello" }
    ],
    "timestamp": "2026-04-20T10:00:01Z",
    "isSidechain": false,
    "agentId": null,
    "isMeta": false,
    "sessionId": "sess_abc",
    "cwd": "/home/user/code/my-project",
    "gitBranch": "main",
    "model": null,
    "usage": null
  }
]
```

---

## Active Sessions

### `GET /api/sessions/active`

List currently running Claude Code sessions (those with active lock files in `~/.claude/sessions/`).

**Response**
```json
[
  {
    "sessionId": "sess_xyz",
    "projectId": "abc123",
    "isAlive": true,
    "startTime": "2026-04-27T09:00:00Z"
  }
]
```

---

## Memory

### `GET /api/memory`

Return all global memory entries from `~/.claude/memory/`.

**Response**
```json
[
  {
    "id": "mem_001",
    "content": "Always use TypeScript strict mode.",
    "type": "preference",
    "createdAt": "2026-04-01T08:00:00Z"
  }
]
```

### `GET /api/memory/:projectId`

Return memory entries scoped to a project.

### `POST /api/memory`

Create a new memory entry.

**Request**
```json
{ "content": "Prefer named exports over default exports.", "type": "preference" }
```

**Response** — `201 Created`
```json
{ "id": "mem_002", "content": "...", "type": "preference", "createdAt": "..." }
```

### `PUT /api/memory/:id`

Update an existing memory entry.

**Request**
```json
{ "content": "Updated content." }
```

### `DELETE /api/memory/:id`

Delete a memory entry. Returns `204 No Content`.

---

## Plans

### `GET /api/plans`

List all plan files from `~/.claude/plans/`.

**Response**
```json
[
  { "slug": "refactor-auth", "title": "Refactor Auth Module", "updatedAt": "2026-04-15T12:00:00Z" }
]
```

### `GET /api/plans/:slug`

Return the markdown content of a plan file.

**Response**
```json
{ "slug": "refactor-auth", "title": "Refactor Auth Module", "content": "# Refactor Auth\n\n..." }
```

### `PUT /api/plans/:slug`

Save a plan file.

**Request**
```json
{ "content": "# Updated Plan\n\n..." }
```

---

## Tasks

### `GET /api/tasks`

List active task lock files from `~/.claude/`.

**Response**
```json
[
  { "id": "task_001", "name": "Build frontend", "status": "in_progress", "createdAt": "..." }
]
```

---

## Settings

### `GET /api/settings`

Return the contents of `~/.claude/settings.json`.

**Response**
```json
{
  "model": "claude-sonnet-4-6",
  "hooks": {},
  "permissions": {}
}
```

### `PUT /api/settings`

Merge the request body into `~/.claude/settings.json`. Existing keys not present in the request are preserved.

**Request**
```json
{ "model": "claude-opus-4-7" }
```

**Response**
```json
{ "updated": true }
```

---

## Plugins

### `GET /api/plugins`

List installed plugins from `~/.claude/`.

---

## Skills

### `GET /api/skills`

List installed skills from `~/.claude/skills/`.

---

## Commands

### `GET /api/commands`

List slash commands from `~/.claude/commands/`.

---

## Hooks

### `GET /api/hooks`

Return the `hooks` section from the global Claude settings.

---

## Rules

### `GET /api/rules`

Return the `rules` section from the global Claude settings.

---

## CLAUDE.md

### `GET /api/claude-md`

Return the contents of the global `CLAUDE.md` file.

### `GET /api/claude-md/:projectId`

Return the project-level `CLAUDE.md` file.

### `PUT /api/claude-md`

Save the global `CLAUDE.md`.

**Request**
```json
{ "content": "# Global Claude instructions\n\n..." }
```

---

## History

### `GET /api/history`

Return session history log entries.

---

## Analytics

### `GET /api/analytics/stats?days=30`

Return cached analytics statistics. `days` accepts `7`, `30`, `90`, or `all`.

**Response**
```json
{
  "totalTokens": 1234567,
  "totalCost": 3.45,
  "dailyActivity": [...],
  "modelBreakdown": {...},
  "projectBreakdown": {...},
  "planModeUsage": {...}
}
```

### `POST /api/analytics/scan?days=30`

Trigger a full JSONL rescan and return fresh stats. Use when new sessions have been added and the cache is stale.

**Response**
```json
{
  "scanned": 142,
  "stats": { ... }
}
```

### `GET /api/analytics/codeburn?days=30`

Return cost estimates computed by the Codeburn service, including task-category breakdown and USD/CAD exchange rate.

**Response**
```json
{
  "totalUsd": 3.45,
  "totalCad": 4.72,
  "exchangeRate": 1.367,
  "categories": {
    "coding": { "sessions": 42, "cost": 1.20 },
    "debugging": { "sessions": 18, "cost": 0.80 }
  }
}
```

---

## Advisor

### `GET /api/advisor`

Return advisor tool call history aggregated across all projects.

**Response**
```json
{
  "total": 87,
  "byProject": [
    { "projectId": "abc123", "name": "my-project", "count": 23 }
  ],
  "recent": [...]
}
```

### `POST /api/advisor/scan`

Trigger a rescan of all JSONL files for advisor calls.

---

## Codex

### `GET /api/codex`

Return Codex usage log entries.

### `POST /api/codex/scan`

Trigger a rescan.

---

## Codex CLI Sessions

### `GET /api/codex-cli/sessions`

List all Codex CLI sessions from `~/.codex/`.

Query parameters: `q` (search), `sort` (`date` | `name`), `filter` (status filter).

**Response**
```json
[
  {
    "id": "codex_sess_001",
    "title": "Implement auth module",
    "createdAt": "2026-04-20T08:00:00Z",
    "status": "completed",
    "note": "Used GPT-4o for initial scaffolding"
  }
]
```

### `GET /api/codex-cli/sessions/:id`

Return full detail for a single Codex CLI session.

### `PUT /api/codex-cli/sessions/:id/note`

Save a note on a session.

**Request**
```json
{ "note": "Useful reference for OAuth patterns." }
```

---

## Codex CLI Skills

### `GET /api/codex-cli/skills`

List skills available to the Codex CLI from `~/.codex/skills/`.

---

## Codex CLI Settings

### `GET /api/codex-cli/settings`

Return Codex CLI settings from `~/.codex/settings.json`.

---

## Codex CLI Memory

### `GET /api/codex-cli/memory`

Return Codex CLI memory entries from `~/.codex/memory/`.

---

## Codex CLI Analytics

### `GET /api/codex-cli/analytics`

Return Codex CLI usage statistics.

---

## Managed Agents

Requires `ANTHROPIC_API_KEY` to be set. All endpoints proxy to the Anthropic Managed Agents API.

### `GET /api/agents/status`

Check whether an API key is configured.

**Response**
```json
{ "has_api_key": true }
```

### `GET /api/agents`

List all managed agents.

### `POST /api/agents`

Create a managed agent.

**Request**
```json
{
  "name": "Code Reviewer",
  "model": "claude-sonnet-4-6",
  "system_prompt": "You are a thorough code reviewer..."
}
```

**Response** — `201 Created`

### `GET /api/agents/:id`

Get a single agent by ID.

### `PUT /api/agents/:id`

Update an agent.

### `DELETE /api/agents/:id`

Delete an agent. Returns `{ "deleted": true }`.

### `GET /api/agents/environments`

List agent environments.

### `POST /api/agents/environments`

Create an environment.

### `GET /api/agents/environments/:id`

Get an environment.

### `PUT /api/agents/environments/:id`

Update an environment.

### `DELETE /api/agents/environments/:id`

Delete an environment.

### `GET /api/agents/sessions`

List agent sessions. Optional query parameter: `agent_id`.

### `POST /api/agents/sessions`

Create a new agent session.

**Request**
```json
{ "agent_id": "agent_abc", "environment_id": "env_xyz" }
```

### `GET /api/agents/sessions/:id`

Get session details.

### `POST /api/agents/sessions/:id/message`

Send a message to an active session.

**Request**
```json
{ "message": "Review this function for edge cases." }
```

### `GET /api/agents/sessions/:id/events`

Server-Sent Events stream for a session. Each event has a type and a JSON data payload.

```
event: message
data: {"role":"assistant","content":"..."}

event: done
data: {}
```

---

## Agent Library

### `GET /api/agent-library`

List all entries in the local agent library.

**Response**
```json
[
  {
    "id": "lib_001",
    "name": "PR Reviewer",
    "slug": "pr-reviewer",
    "description": "Reviews pull requests for code quality.",
    "tags": ["review", "git"],
    "installed_skill": true,
    "installed_subagent": false,
    "notes": "Works best with focused diffs."
  }
]
```

### `POST /api/agent-library`

Create a new agent library entry. Returns `201 Created`.

### `GET /api/agent-library/:id`

Get a single entry.

### `PUT /api/agent-library/:id`

Update an entry.

### `DELETE /api/agent-library/:id`

Delete an entry.

### `POST /api/agent-library/:id/install-skill`

Install the agent as a Claude Code skill to `~/.claude/skills/`.

### `POST /api/agent-library/:id/uninstall-skill`

Uninstall the skill.

### `POST /api/agent-library/:id/install-subagent`

Install the agent as a subagent definition to `~/.claude/agents/`.

### `POST /api/agent-library/:id/uninstall-subagent`

Uninstall the subagent.

---

## MCP Servers

### `GET /api/mcp-servers`

Return MCP server entries from the Claude settings.

---

## Routines

### `GET /api/routines`

Return routine invocation history.

---

## Insights

### `GET /api/insights`

Return aggregated usage insights.

---

## Changelog

### `GET /api/changelog`

Return Claude Code release notes and What's New entries.

---

## Health

### `GET /api/health/references`

Scan the Claude configuration for broken references.

**Response**
```json
{
  "count": 2,
  "issues": [
    {
      "type": "skill",
      "resource": "my-skill",
      "brokenRef": "SKILL.md",
      "hint": "Skill directory 'my-skill' has no SKILL.md descriptor"
    },
    {
      "type": "hook",
      "resource": "PostToolUse[0]",
      "brokenRef": "command",
      "hint": "Hook in PostToolUse at index 0 has an empty command"
    }
  ]
}
```

Issue types:
- `skill` — skill directory missing `SKILL.md`
- `command` — slash command file has invalid YAML frontmatter
- `agent_library` — agent marked as installed but target file is missing
- `hook` — hook entry with an empty `command` string

---

## Real-time — SSE

### `GET /api/sse`

Persistent Server-Sent Events stream. The frontend maintains a single connection for the lifetime of the app session.

Event types:

| Event | Payload | Description |
|---|---|---|
| `session_update` | `{ "sessionId": "..." }` | A session file changed |
| `message_update` | `{ "sessionId": "...", "projectId": "..." }` | A conversation JSONL file changed |
| `memory_update` | `{ "projectId": "..." }` | A memory file changed |
| `ping` | `{}` | Keepalive sent every 15 seconds |
