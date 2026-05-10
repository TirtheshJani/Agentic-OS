---
domain: coding
source: human
created: 2026-05-10
updated: 2026-05-10
tags: [claude-code, agent-sdk, agent-loop, orchestration, reference]
---

# Claude Agent SDK — how the agent loop works

Reference for the message lifecycle, tool execution, context window, and
hooks that drive any Claude Agent SDK session. Skills in this repo and
every dashboard run execute inside this loop, so this page is the local
translation of Anthropic's official guide. Canonical source:
`https://docs.claude.com/en/agent-sdk/`.

## The loop at a glance

Every session follows the same cycle:

1. **Receive prompt.** Claude receives the prompt, system prompt, tool
   definitions, and conversation history. The SDK yields a
   `SystemMessage` with subtype `init` carrying session metadata.
2. **Evaluate and respond.** Claude responds with text, tool calls, or
   both. The SDK yields an `AssistantMessage`.
3. **Execute tools.** The SDK runs each requested tool and feeds results
   back as a `UserMessage`. Hooks can intercept, modify, or block.
4. **Repeat.** Steps 2–3 cycle until Claude produces a response with no
   tool calls. Each cycle is one turn.
5. **Return result.** The SDK yields a final `AssistantMessage` (text
   only) followed by a `ResultMessage` with the final text, token usage,
   cost, and `session_id`.

A trivial question is one or two turns. A complex task can chain dozens.

## Turns and messages

A turn is one round trip: Claude emits tool calls, the SDK executes them,
results feed back. This happens without yielding to your code. The loop
ends when Claude produces output with no tool calls.

Walkthrough — prompt: *"Fix the failing tests in auth.ts"*:

1. **Turn 1:** Claude calls `Bash` with `npm test`. SDK yields the tool
   call, runs it, yields the failure output.
2. **Turn 2:** Claude calls `Read` on `auth.ts` and `auth.test.ts`.
3. **Turn 3:** Claude calls `Edit` on `auth.ts`, then `Bash` to re-run
   tests. They pass.
4. **Final turn:** Claude responds with text only — "Fixed the auth bug,
   all three tests pass now." SDK yields a `ResultMessage`.

Cap the loop with `max_turns` / `maxTurns` (counts tool-use turns only)
or `max_budget_usd` / `maxBudgetUsd`. Without limits, open-ended prompts
("improve this codebase") can run long.

## Message types

| Type              | When emitted                                           | Notes                                                                    |
|-------------------|--------------------------------------------------------|--------------------------------------------------------------------------|
| `SystemMessage`   | Session lifecycle (`init`, `compact_boundary`)         | TS uses a separate `SDKCompactBoundaryMessage` type for compaction       |
| `AssistantMessage`| After each Claude response, including the final one    | Contains text and tool-call blocks                                       |
| `UserMessage`     | After each tool execution, plus any streamed user input| Carries tool result content                                              |
| `StreamEvent`     | Only when partial messages are enabled                 | Raw API streaming events (text deltas, tool input chunks)                |
| `ResultMessage`   | Loop end                                               | Final text, usage, cost, `session_id`. Trailing system events may follow |

In Python, check types with `isinstance()` against classes from
`claude_agent_sdk`. In TypeScript, check the `type` string field;
`AssistantMessage` and `UserMessage` wrap the API message in `.message`,
so content is at `message.message.content`.

```python
from claude_agent_sdk import query, AssistantMessage, ResultMessage

async for message in query(prompt="Summarize this project"):
    if isinstance(message, AssistantMessage):
        print(f"Turn completed: {len(message.content)} blocks")
    if isinstance(message, ResultMessage):
        if message.subtype == "success":
            print(message.result)
```

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

for await (const message of query({ prompt: "Summarize this project" })) {
  if (message.type === "assistant") {
    console.log(`Turn: ${message.message.content.length} blocks`);
  }
  if (message.type === "result" && message.subtype === "success") {
    console.log(message.result);
  }
}
```

## Tool execution

### Built-in tools

| Category        | Tools                                              | Use                                              |
|-----------------|----------------------------------------------------|--------------------------------------------------|
| File operations | `Read`, `Edit`, `Write`                            | Read, modify, create files                       |
| Search          | `Glob`, `Grep`                                     | Find files, regex over content                   |
| Execution       | `Bash`                                             | Shell, scripts, git                              |
| Web             | `WebSearch`, `WebFetch`                            | Search and fetch the web                         |
| Discovery       | `ToolSearch`                                       | Load tools on-demand instead of preloading       |
| Orchestration   | `Agent`, `Skill`, `AskUserQuestion`, `TodoWrite`   | Subagents, skills, user prompts, task tracking   |

Beyond built-ins: connect MCP servers, define custom tool handlers, or
load project skills via setting sources.

### Permissions

Three options work together:

- **`allowed_tools` / `allowedTools`** auto-approves listed tools.
- **`disallowed_tools` / `disallowedTools`** blocks listed tools.
- **`permission_mode` / `permissionMode`** governs everything else.

Tools can be scoped: `"Bash(npm *)"` allows only `npm` invocations. When
a tool is denied, Claude receives a rejection as the tool result and
typically tries another path.

### Parallel execution

Read-only tools (`Read`, `Glob`, `Grep`, MCP tools marked read-only) run
concurrently. State-mutating tools (`Edit`, `Write`, `Bash`) run
sequentially. Custom tools default to sequential; set `readOnlyHint` in
the tool annotations to opt in to parallelism.

## Controlling the loop

| Option                                           | Controls                          | Default        |
|--------------------------------------------------|-----------------------------------|----------------|
| `max_turns` / `maxTurns`                         | Tool-use round trips              | No limit       |
| `max_budget_usd` / `maxBudgetUsd`                | Spend cap                         | No limit       |
| `effort`                                         | Reasoning depth                   | Model default  |
| `permission_mode` / `permissionMode`             | What happens to uncovered tools   | `default`      |
| `model`                                          | Which Claude model                | Auth-dependent |

### Effort levels

| Level     | Behavior                          | Good for                                   |
|-----------|-----------------------------------|--------------------------------------------|
| `low`     | Minimal reasoning, fast           | File lookups, listings                     |
| `medium`  | Balanced                          | Routine edits                              |
| `high`    | Thorough analysis                 | Refactors, debugging                       |
| `xhigh`   | Extended depth                    | Coding/agentic; recommended on Opus 4.7    |
| `max`     | Maximum depth                     | Multi-step problems needing deep analysis  |

`effort` trades latency and tokens for depth within each response.
Extended thinking is independent and produces visible chain-of-thought
blocks in output.

### Permission modes

| Mode                       | Behavior                                                                      |
|----------------------------|-------------------------------------------------------------------------------|
| `default`                  | Uncovered tools trigger the approval callback; no callback means deny         |
| `acceptEdits`              | Auto-approves file edits and common filesystem `Bash` commands                |
| `plan`                     | Read-only tools only; produces a plan without editing source                  |
| `dontAsk`                  | Never prompts; pre-approved tools run, everything else is denied              |
| `auto` (TypeScript)        | Model classifier approves or denies each call                                 |
| `bypassPermissions`        | Runs everything without asking. Isolated environments only                    |

Interactive apps: `default` plus an approval callback. Autonomous dev
agents: `acceptEdits` with explicit `Bash` allowlists. CI/containers:
`bypassPermissions` only when nothing the agent can touch matters.

## The context window

Context accumulates across turns within a session — system prompt, tool
definitions, conversation history, tool inputs, and tool outputs.
Constant content (system prompt, tool defs, `CLAUDE.md`) is prompt-cached
automatically.

| Source              | When it loads          | Impact                                                              |
|---------------------|------------------------|---------------------------------------------------------------------|
| System prompt       | Every request          | Small fixed cost                                                    |
| `CLAUDE.md`         | Session start          | Re-injected each request, prompt-cached after the first             |
| Tool definitions    | Every request          | Each tool adds its schema; `ToolSearch` defers loading              |
| Conversation        | Accumulates over turns | Prompts, responses, tool inputs, tool outputs                       |
| Skill descriptions  | Session start          | Short summaries; full content loads only when invoked               |

### Automatic compaction

When the window approaches its limit, the SDK summarizes older history
and emits a message with `type: "system"` and `subtype:
"compact_boundary"` (TypeScript: `SDKCompactBoundaryMessage`).
Compaction replaces older messages with a summary, so early-prompt
specifics may not survive — put persistent rules in `CLAUDE.md`, which
is re-injected on every request. (`vault/CLAUDE.md` already does this
for vault-bound runs.)

Customizations:

- **Summary instructions in `CLAUDE.md`.** Add a section telling the
  compactor what to preserve (file paths, decisions, error messages).
- **`PreCompact` hook.** Run custom logic before compaction; receives a
  `trigger` field (`manual` or `auto`).
- **Manual compaction.** Send `/compact` as a prompt string.

### Keeping context efficient

- Use subagents for subtasks. Each starts with a fresh conversation;
  only the final response returns to the parent.
- Scope tools per subagent. Each tool definition costs context.
- Watch MCP server cost. Each server adds all its tool schemas to every
  request. `ToolSearch` defers loading.
- Use lower `effort` for routine reads.

## Sessions and continuity

Capture `ResultMessage.session_id` to resume later. The TypeScript SDK
also exposes it on the init `SystemMessage` directly; Python nests it in
`SystemMessage.data`. Resuming restores full context (files read,
analysis done, actions taken). Sessions can also be forked to branch
without modifying the original.

In Python, `ClaudeSDKClient` handles session IDs automatically across
calls.

## Result handling

`ResultMessage.subtype` is the primary termination signal:

| Subtype                                 | Meaning                                          | `result` set? |
|-----------------------------------------|--------------------------------------------------|---------------|
| `success`                               | Finished normally                                | Yes           |
| `error_max_turns`                       | Hit `maxTurns` before finishing                  | No            |
| `error_max_budget_usd`                  | Hit `maxBudgetUsd` before finishing              | No            |
| `error_during_execution`                | API failure or cancellation                      | No            |
| `error_max_structured_output_retries`   | Structured-output validation retries exhausted   | No            |

All subtypes carry `total_cost_usd`, `usage`, `num_turns`, and
`session_id`. In Python, `total_cost_usd` and `usage` are optional and
may be `None` on error paths — guard before formatting.

`stop_reason` indicates why the model stopped on its final turn:
`end_turn` (normal), `max_tokens` (output cap), `refusal` (declined the
request). On error subtypes it carries the value from the last assistant
response before the loop ended.

## Hooks

Callbacks that fire at specific points. Hooks run in your application
process, not the agent's context window, so they don't consume context.
A `PreToolUse` hook that rejects a call short-circuits the loop and
delivers the rejection to Claude.

| Hook                              | Fires                                  | Common use                                        |
|-----------------------------------|----------------------------------------|---------------------------------------------------|
| `PreToolUse`                      | Before a tool runs                     | Validate inputs, block dangerous commands         |
| `PostToolUse`                     | After a tool returns                   | Audit outputs, trigger side effects               |
| `UserPromptSubmit`                | When a prompt is sent                  | Inject extra context                              |
| `Stop`                            | When the agent finishes                | Validate, save state                              |
| `SubagentStart` / `SubagentStop`  | Subagent lifecycle                     | Aggregate parallel results                        |
| `PreCompact`                      | Before compaction                      | Archive full transcript                           |

## How this repo uses the loop

Three concrete touch-points exist in Agentic-OS:

1. **`dashboard/lib/claude-headless.ts`** spawns `claude -p <prompt>
   --output-format stream-json --verbose`, parses the JSONL stream, and
   yields normalized events to `app/api/run/route.ts`. Each JSONL line
   maps to one of the message types above. The dashboard captures
   `runs.output_path` from the final `AssistantMessage` text or the last
   `Edit`/`Write` tool target. The `done` event corresponds to
   `ResultMessage`; an error subtype maps to `runs.status='error'` plus
   the subtype string.

2. **`automations/local/*.sh`** wrap `claude -p` headless invocations
   for laptop-only on-demand runs. No streaming UI: the shell exits when
   the loop returns its `ResultMessage`. Use `--max-turns` and explicit
   `--allowed-tools` flags here for predictable, bounded runs.

3. **`standards/skill-authoring.md` §6 — five orchestration patterns.**
   Each pattern maps to specific loop primitives:

   | Pattern                          | Loop primitive                                                           |
   |----------------------------------|--------------------------------------------------------------------------|
   | Sequential workflow              | Chained tool calls within one session, gated turn-by-turn                |
   | Multi-MCP coordination           | Multiple MCP tool definitions loaded into one loop                       |
   | Iterative refinement             | Many turns gated by tool results (tests pass, lint clean, etc.)          |
   | Context-aware tool selection     | `ToolSearch` plus scoped `allowed_tools` per subagent                    |
   | Domain-specific intelligence     | System prompts plus `CLAUDE.md` re-injection on every request            |

The vault-side rule (`vault/CLAUDE.md`) — that every wiki page declares
a domain and skills honor `metadata.outputs` — exploits the same
re-injection guarantee: rules placed in `CLAUDE.md` survive compaction.

## References

External:

- `https://docs.claude.com/en/agent-sdk/` — SDK overview
- `https://docs.claude.com/en/agent-sdk/python` — Python reference
- `https://docs.claude.com/en/agent-sdk/typescript` — TypeScript reference
- `https://docs.claude.com/en/agent-sdk/hooks` — hooks API
- `https://docs.claude.com/en/agent-sdk/permissions` — permission rules
- `https://docs.claude.com/en/agent-sdk/sessions` — session management
- `https://docs.claude.com/en/agent-sdk/streaming-output` — partial messages
- `https://docs.claude.com/en/agent-sdk/subagents` — subagent inheritance
- `https://docs.claude.com/en/agent-sdk/mcp` — MCP server integration
- `https://docs.claude.com/en/how-claude-code-works` — broader conceptual picture

Internal:

- `standards/skill-authoring.md` — orchestration patterns referenced above
- `dashboard/lib/claude-headless.ts` — JSONL event parser
- `vault/CLAUDE.md` — vault-side rules that ride on `CLAUDE.md` re-injection
