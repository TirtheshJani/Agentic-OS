# Runtimes and CLIs: who needs what

`claude` + `gemini` + `gh` cover everything; `agy` (Antigravity) is an
optional third runtime. With those installed and logged in, **no other CLI
is needed**. (Antigravity superseded Codex as the third runtime — ADR-023;
nothing in the runtime registry blocks adding more.)

## Feature × CLI matrix

| Feature | claude | gemini | agy | gh |
|---|---|---|---|---|
| Agent runs (claude-code runtime) | **required** | — | — | — |
| Agent runs (gemini-cli runtime) | — | **required** | — | — |
| Agent runs (antigravity-cli runtime) | — | — | **required** | — |
| AI agent drafting (`/agents` → draft) | **required** (headless `claude -p`) | — | — | — |
| `/new` orchestrator draft | **required** (headless `claude -p`) | — | — | — |
| `/new` GitHub repo creation | — | — | — | **required** (else local-only) |
| Clone-from-GitHub project mode | — | — | — | preferred (falls back to `git clone`) |
| Agents using GitHub inside runs (PRs, issues) | — | — | — | required for those agents |
| Scheduler / auto-router / handoffs | — | — | — | — (HTTP + SQLite only) |
| MCP (Gmail, Calendar) per-project injection | claude-code runs only | global `~/.gemini/settings.json` only | global config only | — |

## The three runtimes

| | claude-code | gemini-cli | antigravity-cli |
|---|---|---|---|
| Bills | Claude Max plan (logged-in CLI) | Google AI Pro account | Google Antigravity account |
| Spawn | `claude --dangerously-skip-permissions` in a PTY | `gemini --yolo --skip-trust --session-id <uuid>` | `agy --prompt-interactive <prompt> --dangerously-skip-permissions` |
| Session id | hook or jsonl watcher (30s race) | self-assigned UUID (instant) | self-assigned UUID marker (instant) |
| Resume / open-in-terminal | yes (`claude --resume <sid>`) | no (hidden in UI; `gemini --resume latest --yolo --skip-trust`) | yes (`agy --continue --dangerously-skip-permissions`, cwd-scoped) |
| Hooks (SessionStart etc.) | yes | no | no |
| MCP injection per worktree | yes | no (global config only) | no (global config only) |

Capability flags live in `lib/runtime/types.ts`; the UI degrades per
flag (spec 0007). Headless `claude -p` is reserved for the two one-shot
draft endpoints because subscription headless use draws from the monthly
Agent SDK credit pool — runs themselves are interactive PTY sessions and
bill the plans normally.

## Practical guidance

- **Gemini authenticated, anything else?** No. You already have claude
  (runs + drafts), gemini (second runtime), gh (repo ops). That is the
  complete set.
- Keep claude as the default runtime; route overflow or
  paradigm-comparison work to gemini per agent (`runtime:` frontmatter)
  or per project (`runtime-default:`).
- `gh auth status` should name your account; `/connections` checks all
  three with a 60s cache.
