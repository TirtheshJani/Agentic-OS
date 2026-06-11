# Conversations

The Conversations section lets you browse the full history of every Claude Code session across all your projects.

## How it works

Claude Code writes each conversation to a JSONL file under `~/.claude/projects/<encoded-path>/`. Claude Control Center decodes the hashed directory names back to human-readable project paths and groups sessions by project.

Each line in a JSONL file is a message: a user turn, an assistant response, or a tool call/result block. The backend parses these on request — nothing is pre-indexed beyond the lightweight analytics cache.

## Navigation

- **`/conversations`** — Project list. Shows all projects Claude Code has worked in, ordered by last active date.
- **`/conversations/:projectId`** — Session list for a project. Each session shows the start time, message count, and model used.
- **`/conversations/:projectId/:sessionId`** — Full message thread. Renders user messages, assistant responses, and tool calls in chronological order.

## Message thread

Each message is rendered as a bubble. Key features:

- **Tool call blocks** — `Bash`, `Read`, `Edit`, `Write`, and other tool invocations are shown inline with their inputs and outputs, collapsible to save space.
- **Sidechains** — Background processes or "thinking" threads spawned by Claude are explicitly labeled as sidechains. You can expand these to see the internal reasoning or sub-tasks Claude performed.
- **Subagent drawer** — When Claude spawned a subagent during the session, a drawer panel lets you inspect the subagent's own complete message thread, providing full transparency into delegated tasks.
- **Session metadata** — Model name, token usage, working directory, git branch, and timestamp are shown in the session header.
- **Live indicator** — Active sessions (those with an open lock file) show a pulsing dot. The message thread polls for new messages via the SSE connection.

## Data access

The backend only reads JSONL files. It never modifies them. If you delete or edit a JSONL file outside the app, the change is reflected immediately on the next page load.

## Large sessions

Very long sessions (thousands of messages) are rendered with virtualised scrolling via `@tanstack/react-virtual` to keep the UI responsive.
