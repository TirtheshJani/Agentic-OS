# Settings & Configuration

The Settings section provides a GUI for managing your Claude Code configuration — settings JSON, plugins, skills, slash commands, hooks, rules, and `CLAUDE.md` files.

## Settings editor (`/settings`)

The main Settings page reads `~/.claude/settings.json` and renders it in a CodeMirror JSON editor with syntax highlighting and validation.

Click **Save** to write changes back to disk. The backend merges the submitted object with the existing file, preserving any keys not present in the request body. Writes are atomic (`.tmp` → `os.replace()`).

Common settings keys:

| Key | Description |
|---|---|
| `model` | Default model for new sessions |
| `permissions` | Tool permission overrides |
| `hooks` | Event hooks (see [Hooks](#hooks)) |
| `rules` | Behavior rules |
| `env` | Environment variables injected into sessions |

## Plugins

The **Plugins** tab lists extensions installed to `~/.claude/`. Plugins add tools, slash commands, or other capabilities to Claude Code sessions.

## Skills

The **Skills** tab lists skills installed to `~/.claude/skills/`. Each skill is a directory containing a `SKILL.md` descriptor. Skills can also be installed and uninstalled via the [Agent Library](./managed-agents.md).

The [Health Monitor](./health.md) flags skill directories that are missing their `SKILL.md` file.

## Slash commands

The **Commands** tab lists custom slash commands defined in `~/.claude/commands/`. Each command is a markdown file with optional YAML frontmatter defining parameters and description.

Malformed frontmatter is flagged by the [Health Monitor](./health.md).

## Hooks (`/hooks`)

Hooks are shell commands that Claude Code runs automatically in response to events. The Hooks page reads the `hooks` key from `~/.claude/settings.json` and presents each hook entry in a readable format.

Hook events:
- `PreToolUse` — runs before a tool call
- `PostToolUse` — runs after a tool call
- `Notification` — runs when Claude sends a notification
- `Stop` — runs when a session ends

Each hook entry specifies a matcher (which tool or event triggers it) and a shell command to execute.

The [Health Monitor](./health.md) flags hooks with empty `command` strings.

## Rules (`/rules`)

Rules are natural-language constraints Claude Code follows during sessions. The Rules page reads the `rules` key from settings and presents them for review.

## CLAUDE.md (`/claude-md`)

`CLAUDE.md` files contain persistent instructions Claude Code reads at the start of each session. There are two scopes:

- **Global** — `~/.claude/CLAUDE.md` — applies to all sessions.
- **Project** — `<project-root>/CLAUDE.md` — applies only when working in that project.

The CLAUDE.md page renders the file contents in a CodeMirror markdown editor. Save writes the file to disk.

## MCP Servers (`/mcp-servers`)

The MCP Servers page lists Model Context Protocol servers configured in your Claude settings. MCP servers extend Claude Code with additional tools and resources. The page is read-only — edit the entries directly in Settings → JSON editor.
