# Setup: from clean machine to first agent run

## Prerequisites

- **Node 22+** and npm (the dashboard pins `@types/node` 22; older majors
  are untested).
- **git** with `user.name` and `user.email` configured (scaffold commits
  need them).
- **Windows, macOS, or Linux.** The desktop launcher and notes below are
  Windows-flavored; everything else is cross-platform.

## 1. Install

```bash
git clone https://github.com/TirtheshJani/Agentic-OS
cd Agentic-OS/dashboard
npm install
```

## 2. Authenticate the CLIs (one-time, interactive)

| CLI | Install | Login | Needed for |
|---|---|---|---|
| `claude` | `npm i -g @anthropic-ai/claude-code` | run `claude`, log in (Max plan) | agent runs, agent drafting, the `/new` orchestrator draft |
| `gemini` | `npm i -g @google/gemini-cli` | run `gemini`, Google OAuth (AI Pro) | optional second runtime |
| `gh` | `winget install GitHub.cli` | `gh auth login` | repo creation from `/new`, cloning, agents using GitHub inside runs |

The `/connections` view shows live status for all three. See
`docs/runtimes-and-clis.md` for exactly which feature needs which CLI.

## 3. First boot

```bash
npm run dev          # http://localhost:3000
npm test             # 156+ tests should pass
```

Or launch like a desktop app (installs deps on first run, reuses a
running server, opens an app-frame window):

```powershell
powershell -ExecutionPolicy Bypass -File bin/install-shortcut.ps1   # once
# then "Agentic OS" in the Start Menu, or:
bin/launch-dashboard.ps1
bin/launch-dashboard.ps1 -Stop     # stop the background server
```

## 4. One-time settings

Open `/settings`:

- **workspaceRoot** — the parent folder where project repos live (and
  where `/new` creates new ones). Default is `~/code`; set it to your
  GitHub folder, e.g. `C:\Users\TJ\Documents\GitHub`.
- **Autonomy** stays off until you want the auto-router and scheduler
  acting on queued issues by themselves.

## 5. First project

Two paths:

- **`/new` (recommended):** describe the project in a sentence or two.
  The orchestrator drafts a plan (one Claude call), scaffolds the repo,
  creates the GitHub remote, registers the vault project, creates the
  agent crew, and files kickoff issues. See
  `instructions/create-project.md`.
- **Dashboard → + New Project:** link an existing folder or clone an
  existing GitHub repo, then add agents from `/agents`.

To run an agent on an issue: open the project board, drag the issue to
**Queued** (with autonomy on the router assigns + starts it) or open the
issue and start a run manually. The terminal streams live in the issue
drawer.

## Environment variables (rarely needed)

| Var | Default | Use |
|---|---|---|
| `PORT` | 3000 | dashboard port (the launcher sets it; `set PORT=3001` to run a second instance) |
| `AGENTIC_OS_REPO_ROOT` | auto (parent of `dashboard/`) | tests / unusual layouts |
| `AGENTIC_OS_STATE_DIR` | `<repo>/.agentic-os` | relocate SQLite + settings + MCP templates |
| `AGENTIC_OS_PUBLIC_URL` | `http://localhost:3000` | hook callback base URL behind a proxy |
| `TERMINAL` | unset | external terminal used by open-in-terminal |

`dashboard/.env.example` mirrors this table.

## Troubleshooting

See `docs/troubleshooting.md` (port 3000 conflicts, lost create jobs,
gh scopes, PTY quirks).
