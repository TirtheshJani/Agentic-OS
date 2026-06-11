# Claude Control Center

> A self-hosted web dashboard for monitoring, managing, and analysing your [Claude Code](https://claude.ai/code) activity.

Claude Control Center reads your `~/.claude` directory directly and presents conversations, memory, plans, tasks, analytics, managed agents, Codex sessions, and configuration through a unified local UI — no cloud account, no data export required.

---

## Features

### Conversations
Browse every past Claude Code session across all projects. Full message-thread viewer with tool call expansion, subagent drawer, and metadata (model, tokens, git branch, working directory).

### Analytics & Codeburn
Token usage charts, daily activity heatmaps, model breakdowns, and cost estimates (USD/CAD via live exchange rates). Task-category classification powered by the [Codeburn](https://github.com/AgentSeal/codeburn) pricing model.

### Memory Management
View, create, edit, and delete both global and project-scoped Claude memory entries from a GUI instead of editing raw JSON files.

### Plans & Tasks
Read and edit Claude Code plan files (markdown) with a built-in CodeMirror editor. Inspect active task lock files and their status.

### Settings & Configuration
GUI editor for `settings.json`, plugins, skills, hooks, rules, and slash commands. Live validation and JSON syntax highlighting.

### Managed Agents
Create and manage Anthropic-SDK managed agents and environments. Start sessions, send messages, and watch the live event stream in real time via SSE.

### Agent Library
A local registry for saving and reusing agent definitions. Build, tag, install as skills or subagents, and keep notes on each entry.

### Codex CLI Integration
Scan and browse Codex CLI sessions with filtering, sorting, and session notes. Inspect Codex memory, settings, and skills. View Codex usage analytics.

### Advisor Tracker
Automatic detection and logging of `advisor()` tool calls across all projects. Tracks call frequency and per-project usage.

### Routines
View invocation history for scheduled skill/routine runs.

### Scheduler
In-app cron scheduler (croniter-driven daemon thread) that executes built-in maintenance actions — memory consolidation, session tidy, client digest, eval backfill — on a schedule. Works inside the Docker container with no crontab. Includes a quiet-window guard that defers runs while recent GWS activity shows you're working (max 2 h deferral), plus run-now, enable/disable, and a run-history feed.

### Changelog
Inline Claude Code release notes and What's New feed — stay current without leaving the dashboard.

### Health Monitor
Detects broken references in your Claude configuration: skills missing `SKILL.md`, commands with invalid frontmatter, agent library entries pointing to uninstalled files, and hooks with empty commands.

### MCP Servers
View configured MCP servers from your Claude settings.

### QMD Runner
A repo-local tool for organising and running shell commands stored in markdown files. See [qmd-runner.skill.README.md](./qmd-runner.skill.README.md).

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend framework | React 19 + TypeScript |
| Build tool | Vite 8 |
| Styling | Tailwind CSS v4 |
| Routing | React Router v7 |
| Server state | TanStack Query v5 |
| Real-time | Server-Sent Events (SSE) |
| Charts | Chart.js + react-chartjs-2 |
| Code editor | CodeMirror 6 |
| UI primitives | Radix UI |
| Backend framework | Python 3.11 + Flask |
| HTTP client | httpx |
| JSON | orjson |
| File watching | watchdog |
| Container | Docker + Gunicorn |

---

## Quick Start

### Docker (recommended)

Requires Docker Engine ≥ 24 and Docker Compose v2.

```sh
git clone https://github.com/your-username/claude-control-center.git
cd claude-control-center

# Copy and edit the environment file if needed
cp backend/.env.example backend/.env

# Build and start
docker compose up -d --build
```

Open [http://localhost:5050](http://localhost:5050).

The container mounts `~/.claude` and `~/.codex` from your host. No data leaves your machine.

See [DOCKER_DEPLOY.md](./DOCKER_DEPLOY.md) for resource usage, volume management, log rotation, and troubleshooting.

### Development

Run the backend and frontend in separate terminals.

**Backend:**
```sh
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # edit CLAUDE_DIR / CODEX_DIR if needed
python run.py
```

**Frontend:**
```sh
cd frontend
npm install
npm run dev
```

The frontend dev server runs at [http://localhost:5173](http://localhost:5173) and proxies all `/api` calls to the backend on port 5050.

---

## Configuration

All configuration is via environment variables in `backend/.env`:

| Variable | Default | Description |
|---|---|---|
| `CLAUDE_DIR` | `~/.claude` | Path to your Claude Code data directory |
| `CODEX_DIR` | `~/.codex` | Path to your Codex CLI data directory |
| `PORT` | `5050` | Flask / Gunicorn port |
| `CORS_ORIGIN` | `http://localhost:5173` | Allowed CORS origin (dev only; production uses same origin) |
| `ANTHROPIC_API_KEY` | _(empty)_ | Required only for the Managed Agents feature |
| `MANAGED_AGENTS_BASE_URL` | `https://api.anthropic.com` | Anthropic API base URL |

---

## Security

> **Localhost-only by design.** The backend has no authentication layer.

- Port 5050 is bound to `127.0.0.1` in `docker-compose.yml`. Do not remove that binding unless you add authentication middleware.
- The backend enforces DNS-rebinding protection (Host header validation) and CSRF protection (`X-Requested-With` header check) on all state-changing requests.
- Standard security headers (`X-Content-Type-Options`, `X-Frame-Options`, `Content-Security-Policy`, `Referrer-Policy`, `Permissions-Policy`) are set on all responses.
- `run.py` uses `debug=True` for development only. Production uses Gunicorn via Docker.

---

## Documentation

| Document | Description |
|---|---|
| [docs/architecture.md](./docs/architecture.md) | System architecture, data flow, and design decisions |
| [docs/api-reference.md](./docs/api-reference.md) | Complete REST API reference |
| [docs/development.md](./docs/development.md) | Local development guide and project structure |
| [docs/design.md](./docs/design.md) | Design system: colors, typography, components |
| [DOCKER_DEPLOY.md](./DOCKER_DEPLOY.md) | Docker deployment guide |
| [qmd-runner.skill.README.md](./qmd-runner.skill.README.md) | QMD runner tool |
| [docs/agents/](./docs/agents/) | Managed agent configuration templates |
| [docs/advisor/](./docs/advisor/) | Advisor usage guides |

---

## Contributing

Contributions are welcome. Please read [docs/development.md](./docs/development.md) for the project structure, development workflow, and conventions before opening a pull request.

---

## License

[MIT](./LICENSE)
