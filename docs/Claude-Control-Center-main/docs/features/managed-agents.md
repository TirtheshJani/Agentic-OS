# Managed Agents

The Agents section lets you create, configure, and interact with Anthropic Managed Agents directly from the dashboard.

## Prerequisites

You must set `ANTHROPIC_API_KEY` in `backend/.env` (or as a Docker environment variable). Without it, the Agents page shows a warning banner and all API calls return `401`.

```sh
ANTHROPIC_API_KEY=sk-ant-...
```

## Concepts

**Agent** — A named assistant with a system prompt, model selection, and optional configuration. Agents are persistent entities in the Anthropic API.

**Environment** — A set of tools and resources available to an agent during a session. Environments are also managed via the API.

**Session** — A conversation instance between a user and an agent. Sessions hold message history and can be resumed.

## Workflow

### 1. Create an agent

Go to **Agents** → **New Agent**. Fill in:
- Name
- Model (e.g., `claude-sonnet-4-6`)
- System prompt

The agent is created in the Anthropic API and appears in the agents list.

### 2. Create an environment (optional)

Go to **Agents** → **Environments** → **New Environment**. Environments define which tools the agent can use.

### 3. Start a session

Select an agent and click **Start Session**. Optionally attach an environment. The session opens immediately.

### 4. Send messages

Type a message in the input and press Enter. The response streams in real time via Server-Sent Events. Tool use, thinking blocks, and final responses are all shown as they arrive.

### 5. Review the event stream

The **Agent Session** page (`/agents/sessions/:sessionId`) renders the full SSE event stream: `message_start`, `content_block_delta`, `tool_use`, `tool_result`, `message_stop`, and `error` events.

## Agent Library

The **Agent Library** (`/agent-library`) is a local registry separate from the Anthropic API. Use it to save agent definitions, notes, and tags for reuse.

From the library you can:
- **Install as skill** — writes a `SKILL.md` to `~/.claude/skills/<slug>/` so Claude Code can invoke the agent as a skill.
- **Install as subagent** — writes an agent definition to `~/.claude/agents/<slug>.md`.
- **Build** — opens the Agent Builder form pre-populated with the library entry's configuration.

The Agent Builder (`/agent-library/new` and `/agent-library/:id/edit`) provides a form interface for composing system prompts, setting model and parameters, and adding tags.

## API

See the [API Reference](../api-reference.md#managed-agents) for the full endpoint list. All agent endpoints are under `/api/agents`.

## Notes

- Sessions are not stored locally — they live in the Anthropic API. The dashboard is a thin UI over the API.
- The SSE stream for a session is a proxy: the backend opens an httpx stream to the Anthropic API and forwards events to the browser.
- Rate limit errors are surfaced in the UI with a `429` status and a `rate_limit` error type.
