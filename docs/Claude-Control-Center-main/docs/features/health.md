# Health Monitor

The Health page (`/health`) scans your Claude configuration for broken references and surfaces them as actionable issues.

## What it checks

### Skills missing `SKILL.md`

Every directory in `~/.claude/skills/` is expected to contain a `SKILL.md` descriptor file. Claude Code uses this file to understand what the skill does and how to invoke it. A skill directory without `SKILL.md` is invisible to Claude.

**Fix:** Add a `SKILL.md` file to the skill directory, or remove the directory if the skill is no longer needed.

### Commands with malformed frontmatter

Slash command files in `~/.claude/commands/` are markdown files with optional YAML frontmatter. If the frontmatter is invalid (syntax errors, wrong types), Claude Code may fail to parse the command definition.

**Fix:** Open the command file and correct the YAML block between the `---` delimiters.

### Agent library entries pointing to missing files

When you install an agent from the Agent Library as a skill or subagent, the library records `installed_skill: true` or `installed_subagent: true`. If the corresponding file is later deleted outside the dashboard, this flag becomes stale.

- `installed_skill: true` expects `~/.claude/skills/<slug>/SKILL.md`
- `installed_subagent: true` expects `~/.claude/agents/<slug>.md`

**Fix:** Either reinstall from the Agent Library, or uninstall via the library to clear the flag.

### Hooks with empty commands

Hook entries in `~/.claude/settings.json` must have a non-empty `command` string. An empty command string will cause Claude Code to skip the hook silently, which can mask misconfiguration.

**Fix:** Open Settings and add a command to the hook entry, or delete the hook if it is no longer needed.

## Issue format

Each issue shows:

| Field | Description |
|---|---|
| Type | `skill`, `command`, `agent_library`, or `hook` |
| Resource | The name of the affected skill, command, agent, or hook event |
| Broken reference | What specific file or field is missing or invalid |
| Hint | A plain-language description of the problem and suggested fix |

## When to run it

The Health page fetches fresh results on every load — there is no cache. Run it:

- After installing or uninstalling skills or agents
- After editing hooks or commands
- As a periodic sanity check before relying on Claude Code automation
