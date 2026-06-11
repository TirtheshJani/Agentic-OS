# Architecture — Claude Control Center

## Overview

Claude Control Center is a single-user, self-hosted web application. The backend is a Python Flask server that reads the `~/.claude` and `~/.codex` directories on the host filesystem. The frontend is a React SPA compiled to static files that the Flask server serves in production.

```
Browser (React SPA)
  ├── REST API calls  ──────────────────────────────┐
  └── SSE event stream  ───────────────────────────┐│
                                                   ││
                                         Flask API (Python)
                                                   │
                                   ┌───────────────┴──────────────┐
                                   │                               │
                              ~/.claude                        ~/.codex
                        (conversations, memory,          (Codex sessions,
                         plans, tasks, settings,          skills, memory,
                         skills, commands, hooks)          settings)
```

There is no database. All persistent state lives in the user's existing `~/.claude` and `~/.codex` directories. The backend only writes to these directories for memory edits, plan saves, settings changes, and agent-library entries.

---

## Backend

### Entry point

`backend/run.py` creates the Flask application and starts the development server. In production, the Docker container runs Gunicorn directly against `app:create_app()`.

### Application factory

`backend/app/__init__.py` — `create_app()`:

1. Creates the Flask app and configures CORS.
2. Registers `before_request` and `after_request` hooks for security headers and DNS-rebinding / CSRF defence.
3. Registers all route blueprints via `app.routes.register_blueprints()`.
4. Launches background scanners/watchers via `app.services.start_background_services()`.
5. Registers a catch-all route that serves `frontend/dist/index.html` for any non-API path (SPA routing support).

### Configuration

`backend/app/config.py` reads environment variables (via `python-dotenv`):

| Variable | Config constant | Default |
|---|---|---|
| `CLAUDE_DIR` | `CLAUDE_DIR` | `~/.claude` |
| `CODEX_DIR` | `CODEX_DIR` | `~/.codex` |
| `PORT` | `PORT` | `5050` |
| `CORS_ORIGIN` | `CORS_ORIGIN` | `http://localhost:5173` |
| `ANTHROPIC_API_KEY` | `ANTHROPIC_API_KEY` | `""` |
| `MANAGED_AGENTS_BASE_URL` | `MANAGED_AGENTS_BASE_URL` | `https://api.anthropic.com` |

### Routes

Each feature domain has its own blueprint in `backend/app/routes/`. All API routes are prefixed with `/api/`.

| Blueprint file | URL prefix | Responsibility |
|---|---|---|
| `projects.py` | `/api/projects` | List Claude Code projects (decoded from `~/.claude/projects/`) |
| `conversations.py` | `/api/sessions` | Read and serve JSONL conversation messages |
| `sessions.py` | `/api/sessions/active` | List live sessions from `~/.claude/sessions/` |
| `memory.py` | `/api/memory` | CRUD for global and project memory |
| `plans.py` | `/api/plans` | List, read, and write plan markdown files |
| `tasks.py` | `/api/tasks` | Read active task lock files |
| `settings.py` | `/api/settings` | Read/write `~/.claude/settings.json` |
| `plugins.py` | `/api/plugins` | List plugins |
| `skills.py` | `/api/skills` | List installed skills |
| `commands.py` | `/api/commands` | List slash commands |
| `hooks.py` | `/api/hooks` | Read hooks from settings |
| `rules.py` | `/api/rules` | Read rules from settings |
| `claude_md.py` | `/api/claude-md` | Read/write `CLAUDE.md` files |
| `history.py` | `/api/history` | Session history log |
| `analytics.py` | `/api/analytics` | Token stats, activity, and Codeburn cost estimates |
| `advisor.py` | `/api/advisor` | Advisor call history |
| `codex.py` | `/api/codex` | Codex usage tracker |
| `codex_cli_sessions.py` | `/api/codex-cli/sessions` | Codex CLI session browser |
| `codex_cli_skills.py` | `/api/codex-cli/skills` | Codex CLI skills |
| `codex_cli_settings.py` | `/api/codex-cli/settings` | Codex CLI settings |
| `codex_cli_memory.py` | `/api/codex-cli/memory` | Codex CLI memory |
| `codex_cli_analytics.py` | `/api/codex-cli/analytics` | Codex CLI usage stats |
| `managed_agents.py` | `/api/agents` | Managed agents, environments, sessions, and SSE stream |
| `agent_library.py` | `/api/agent-library` | Local agent library CRUD |
| `mcp_servers.py` | `/api/mcp-servers` | MCP server list from settings |
| `routines.py` | `/api/routines` | Routine invocation history |
| `insights.py` | `/api/insights` | Usage insights |
| `changelog.py` | `/api/changelog` | Claude Code release notes |
| `health.py` | `/api/health` | Broken reference scanner |
| `sse.py` | `/api/events` | Server-Sent Events stream for live updates |

### Services

`backend/app/services/` contains the business logic decoupled from HTTP:

| Service | Responsibility |
|---|---|
| `jsonl_parser.py` | Parse Claude Code JSONL conversation files |
| `project_decoder.py` | Decode hashed project directory names to readable paths |
| `memory_service.py` | Read/write memory JSON files |
| `analytics_service.py` | Scan JSONL files and compute token/activity/plan stats; cache to `data/analytics_stats.json` |
| `codeburn_service.py` | Cost estimation (model pricing table, task classification, USD→CAD exchange rate) |
| `advisor_tracker.py` | Scan JSONL files for `advisor()` tool calls; cache to `data/advisor_usages.json` |
| `codex_tracker.py` | Scan Codex usage files; cache to `data/codex_usages.json` |
| `routines_tracker.py` | Scan routine invocation files; cache to `data/routines_usages.json` |
| `codex_cli_session_scanner.py` | Scan `~/.codex/` session directories |
| `codex_cli_session_meta.py` | Read/write session metadata and notes |
| `codex_cli_memory_reader.py` | Read Codex CLI memory files |
| `codex_cli_settings_reader.py` | Read Codex CLI settings |
| `codex_cli_skills_reader.py` | Read Codex CLI skill files |
| `managed_agents.py` | Proxy for Anthropic Managed Agents API |
| `anthropic_client.py` | httpx-based Anthropic API client |
| `agent_library_service.py` | CRUD for local agent library entries |
| `settings_io.py` | Read global and project Claude settings |
| `skill_installer.py` | Install/uninstall skills to `~/.claude/skills/` |
| `watcher.py` | mtime-based file watcher for SSE events |

### Background scanning

On startup, five background threads scan the filesystem and populate JSON cache files in `backend/data/`. This ensures analytics, advisor counts, and Codex data are available immediately without blocking the first page load. Cache files are written atomically via a `.tmp` → `os.replace()` pattern.

### Real-time updates (SSE)

`backend/app/routes/sse.py` serves a persistent `text/event-stream` response at `/api/events`. The `Watcher` class polls `~/.claude/sessions/` and active project JSONL files for mtime changes on each client request tick. Events are typed as `session_update`, `message_update`, or `memory_update`.

Security note: SSE responses intentionally skip the security-header middleware to preserve chunked transfer encoding.

---

## Frontend

### Entry point

`frontend/src/main.tsx` mounts the React app with `BrowserRouter` and a `QueryClientProvider`. `App.tsx` defines all routes under a shared `AppShell` layout.

### Layout

`AppShell` (`components/layout/AppShell.tsx`) renders the fixed sidebar and the `<Outlet>` for page content. The sidebar (`Sidebar.tsx`) contains navigation links, the brand mark, and the live active-session badge.

### Page components

Each route maps to one page component in `frontend/src/pages/`. Pages are responsible for:
- Fetching data via TanStack Query hooks
- Rendering loading/error/empty states
- Composing domain-specific components

### API layer

`frontend/src/api/` contains one file per domain. Each file exports typed async functions that wrap `fetch` via the central `client.ts`. All mutating requests include `X-Requested-With: XMLHttpRequest` to satisfy the backend's CSRF check.

### Hooks

`frontend/src/hooks/` contains React Query hooks that wrap the API functions. `useSSE.ts` manages the persistent SSE connection and exposes a `connected` boolean plus an event subscription interface.

### State

Global UI state (sidebar collapse, active modal, etc.) is managed by a small Zustand store in `frontend/src/store/uiStore.ts`. Server state is owned entirely by TanStack Query.

### Real-time

`useSSE` shares a single `EventSource` connection to `/api/events`. Components that need live updates subscribe through TanStack Query invalidation, and the sidebar shows a pulsing green dot when the SSE connection is active.

---

## Security model

The application is designed for localhost use by a single trusted user.

| Threat | Mitigation |
|---|---|
| DNS rebinding | Host header validated against an allowlist (`localhost`, `127.0.0.1`) on every request |
| CSRF | All state-changing requests require `X-Requested-With: XMLHttpRequest`; set by the API client |
| Clickjacking | `X-Frame-Options: DENY` |
| MIME sniffing | `X-Content-Type-Options: nosniff` |
| Content injection | `Content-Security-Policy` restricts scripts/styles to `'self'` |
| Network exposure | Docker binds only to `127.0.0.1:5050` by default |
| Privilege escalation | Docker container runs as non-root `appuser` |

There is no authentication layer. Do not expose port 5050 on a network without adding one.

---

## Deployment

### Docker (production)

The `Dockerfile` uses a two-stage BuildKit build:

1. **Build stage** — installs Node dependencies and compiles the frontend to `frontend/dist/`.
2. **Runtime stage** — copies the compiled frontend and Python backend into a slim Python image. Gunicorn serves both the Flask API and the static frontend assets on port 5050.

Resource limits enforced in `docker-compose.yml`: 0.50 CPU cores, 384 MB RAM.

### Development

The Vite dev server proxies `/api/*` requests to `http://localhost:5050`. Hot module replacement is active for the frontend. The Flask dev server (`debug=True`) auto-reloads on Python file changes.

---

## Design decisions

**Flask over FastAPI** — The backend is almost entirely filesystem I/O. Flask's simplicity and zero-overhead startup suit a single-user local tool. FastAPI's async model adds complexity without benefit at this scale.

**SSE over WebSockets** — Live session updates are one-directional (server → browser). SSE is simpler to implement, natively supported without a library, and works cleanly through reverse proxies without HTTP upgrade negotiation.

**No database** — Reading `~/.claude` directly means zero setup for users. A database would require migration management, schema versioning, and an initial import step. The JSON cache files in `backend/data/` serve as lightweight, inspectable indexes.

**Tailwind + CSS custom properties over a component library** — Full design control without fighting upstream opinions. CSS variables allow the design system to be single-source-of-truth while giving Chart.js its required plain hex fallbacks.

**OKLCH colors** — Perceptual uniformity: equal lightness steps look equal, unlike HSL. All modern browsers (2023+) support `oklch()` natively.
