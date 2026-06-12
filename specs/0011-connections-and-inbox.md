# Spec 0011: Connections Hub, MCP Management, Inbox

> **Status:** Shipped with the command-center build (June 2026). See
> ADR-011 for the inbox decision.

## Connections hub (`/connections`)

One view answers "what can my agents reach right now":

- **Claude Code**: CLI on PATH + version (agent runs bill the Max plan via
  the logged-in CLI).
- **Gemini CLI**: CLI + `~/.gemini` profile presence (Google AI Pro OAuth).
- **GitHub**: `gh auth status` exit code + account name. Agents use the
  authenticated gh CLI inside runs; no GitHub MCP needed for v1.
- **Gmail / Google Calendar (MCP)**: template presence under
  `.agentic-os/mcp/<name>.json` plus configured server count. Editable in
  the UI (JSON drawer). Multi-account Gmail = one entry per account in the
  template (recommended server: GongRzhe/Gmail-MCP-Server; verify the
  package and its OAuth flow when configuring the first account).
- **LinkedIn**: status "deferred" (see below).

Detectors live in `lib/connections.ts` with a 60s cache.

## MCP management (`lib/mcp.ts`)

- Templates are JSON objects mapping server name to MCP config, stored
  under the gitignored `.agentic-os/mcp/` (credentials never enter the
  vault, consistent with spec 0006's env-var decision).
- `PROJECT.md` frontmatter gains optional `mcp-servers: [gmail, ...]`.
- `startRunForIssue` injects the named templates into the run worktree
  before spawn (claude-code runs only): merges into `<worktree>/.mcp.json`
  and sets `enableAllProjectMcpServers: true` in
  `.claude/settings.local.json` (merge-writes; the SessionStart hook
  installed by hookInstaller survives). Gemini reads its own global
  `~/.gemini/settings.json`; configure MCP there manually (documented on
  the connections page; per-workspace Gemini MCP config is an open
  question).
- Open question carried from planning: whether
  `--dangerously-skip-permissions` already auto-approves project
  `.mcp.json` servers; `enableAllProjectMcpServers` is set defensively and
  `--mcp-config` remains the fallback if approval still blocks.

## Inbox (`/inbox`)

Vault-backed (ADR-011), three sections:

1. Issues in `review` (links to the global board).
2. Failed runs from the last 7 days.
3. Recent `vault/raw/**` captures and digests (the existing inbox-triage
   skill writes Gmail triage digests there), with Open in Obsidian links.

No live Gmail querying from the Next server: the agent pipeline already
holds auth, leaves an audit trail, and feeds the Phase 6 note index that
the inbox reads.

## LinkedIn: deferred connector slot

Decision (operator, June 2026): LinkedIn has no sanctioned personal-read
API in 2026; automation against a logged-in profile risks the account, and
third-party proxies are paid. The connector slot is reserved in
`lib/connections.ts` (id "linkedin", status "deferred"). What would
unblock it: an official API tier usable for personal read access, a
decision to ingest manual data exports, or acceptance of a paid proxy
(Unipile-style). Any of those becomes a new template/detector pair plus an
ingestion skill; nothing else in the architecture changes.
