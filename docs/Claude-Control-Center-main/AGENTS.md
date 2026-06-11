# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## What this project is

Codex Control Center is a self-hosted web dashboard that reads `~/.Codex` and `~/.codex` on the host filesystem and exposes conversations, memory, plans, tasks, analytics, managed agents, Codex sessions, and configuration through a unified local UI. No database — all persistent state lives in the user's existing directories. The backend writes only for memory edits, plan saves, settings changes, and agent-library entries.

## Development commands

### Backend (Python / Flask)

```sh
cd backend
source venv/bin/activate          # or: python -m venv venv && source venv/bin/activate && pip install -r requirements.txt
python run.py                     # dev server on http://localhost:5050 (debug=True, auto-reload)
```

### Frontend (React / Vite)

```sh
cd frontend
npm install
npm run dev        # dev server on http://localhost:5173, proxies /api/* to :5050
npm run build      # tsc -b && vite build → frontend/dist/
npx tsc --noEmit   # type-check only
```

### Docker (production)

```sh
docker compose build
docker compose up -d
docker compose ps
docker compose logs -f
```

Production serves both frontend and API from port 5050 (bound to `127.0.0.1`). Two-stage build: Node compiles the frontend, then a Python slim image runs Gunicorn. Resource limits: 0.50 CPU, 384 MB RAM.

### QMD runner (dev checks)

```sh
./qmd run qmd-examples/dev-checks.qmd
```

## Architecture

### Backend

**Entry point**: `backend/run.py` → `backend/app/__init__.py:create_app()`

The factory:
1. Registers security middleware (`before_request` DNS-rebinding + CSRF check; `after_request` security headers — both skip for SSE streams).
2. Registers ~30 Flask blueprints, one per feature domain (all under `/api/`).
3. Launches background daemon threads that scan the filesystem and cache results to `backend/data/*.json`. Background scanners: analytics, advisor tracker, codex tracker, routines tracker, Codex CLI session scanner, GWS snapshot, GWS activity, LightRAG memory init.

**Config**: `backend/app/config.py` — reads `CLAUDE_DIR`, `CODEX_DIR`, `PORT`, `CORS_ORIGIN`, `ANTHROPIC_API_KEY`, `MANAGED_AGENTS_BASE_URL`, `GWS_BINARY`, `LIGHTRAG_WORKING_DIR`, and RAG-related vars via `python-dotenv`.

**Route layer** (`backend/app/routes/`): thin blueprints — parse request data, call services, format responses. No business logic in route files.

**Service layer** (`backend/app/services/`): all filesystem I/O and business logic. Key services:
- `jsonl_parser.py` — parse Codex JSONL conversation files
- `project_decoder.py` — decode hashed project directory names to readable paths
- `analytics_service.py` — scan JSONL files, compute token/activity stats, cache to `data/analytics_stats.json`
- `codeburn_service.py` — cost estimation (model pricing, task classification, USD→CAD exchange)
- `memory_rag_service.py` — LightRAG-based RAG over memory entries (requires `ANTHROPIC_API_KEY`)
- `managed_agents.py` + `anthropic_client.py` — proxy for Anthropic Managed Agents API
- `watcher.py` — mtime-based file watcher driving SSE events
- `gws_activity_scanner.py` / `gws_bridge_service.py` — Google Workspace CLI integration

**Cache writes** must use the `.tmp` → `os.replace()` atomic pattern (see existing services for the pattern).

**SSE** (`backend/app/routes/sse.py`): persistent `text/event-stream`. `Watcher` polls `~/.Codex/sessions/` and active JSONL files for mtime changes. Events: `session_update`, `message_update`, `memory_update`. SSE responses skip security-header middleware.

### Frontend

**Entry**: `frontend/src/main.tsx` → `frontend/src/App.tsx` (routes under shared `AppShell` layout)

**Layers**:
- `src/api/` — one file per domain, typed `fetch` wrappers via `client.ts`. Mutating calls get `X-Requested-With: XMLHttpRequest` automatically.
- `src/hooks/` — React Query wrappers around api functions; `useSSE.ts` manages the single `EventSource` connection.
- `src/pages/` — one component per route; owns data fetching and loading/error/empty states.
- `src/components/` — reusable components grouped by domain (`agents/`, `conversation/`, `layout/`, `memory/`, `plans/`, `settings/`, `gws/`).
- `src/store/uiStore.ts` — Zustand for global UI state (sidebar collapse, modals). TanStack Query owns all server state.
- `src/types/index.ts` — shared TypeScript interfaces.

**Routing**: `App.tsx` defines all routes. Add nav links in `Sidebar.tsx`.

## Conventions

### Backend
- One blueprint per feature domain; register in `backend/app/__init__.py`.
- Import paths from `app.config` (`CLAUDE_DIR`, `CODEX_DIR`); never hardcode filesystem paths.
- Use `orjson` for JSON serialisation (faster than stdlib for large JSONL files).
- Background threads must be daemon threads (`daemon=True`).

### Frontend
- `src/components/` for reusable components; page-specific logic in `src/pages/`.
- Use `cn()` from `src/lib/utils.ts` for conditional class names.
- **Chart.js colors must be plain hex or rgba** — CSS variables and `oklch()` are not supported by the canvas renderer. Use the constants at the top of `AnalyticsPage.tsx` as reference.
- Prefer named exports for all components and hooks.
- Do not shadow TanStack Query server state with local `useState`.

### Styling
- Use CSS custom properties from `src/index.css` (e.g., `text-[var(--text-secondary)]`), not raw Tailwind palette classes.
- Use component utility classes (`.card`, `.chip`, `.btn-primary`, `.input-field`, etc.) defined in `src/index.css` under `@layer components` before writing one-off Tailwind compositions.
- Border radius is kept sharp (2–4 px); do not use `rounded-2xl` or higher.
- Colors use OKLCH throughout (perceptual uniformity). All modern browsers (2023+) support `oklch()` natively.

## Adding a new feature (standard pattern)

1. `backend/app/routes/my_feature.py` — blueprint with `url_prefix="/api/my-feature"`
2. Register blueprint in `backend/app/__init__.py`
3. `backend/app/services/my_feature_service.py` — business logic
4. `frontend/src/api/myFeature.ts` — typed fetch wrapper using `apiFetch`
5. `frontend/src/hooks/useMyFeature.ts` — React Query hook
6. `frontend/src/pages/MyFeaturePage.tsx` — page component
7. Add route in `App.tsx`, nav link in `Sidebar.tsx`

## Security model (localhost-only)

- No authentication layer — do not expose port 5050 on a network.
- DNS rebinding: Host header validated against `{localhost, 127.0.0.1}` allowlist.
- CSRF: all mutating requests require `X-Requested-With: XMLHttpRequest` (set by `client.ts`).
- Standard security headers on all non-SSE responses.
- Docker binds to `127.0.0.1:5050` only; container runs as non-root `appuser`.

## LightRAG / Memory RAG

`ANTHROPIC_API_KEY` is required for the memory RAG feature. It uses `Codex-haiku-4-5` for entity/relationship extraction (`ANTHROPIC_HAIKU_MODEL`), local sentence-transformers embeddings (`all-MiniLM-L6-v2`, 384-dim), and a daily USD budget cap (`MEMORY_DAILY_BUDGET_USD`, default $5). Storage lives in `backend/data/lightrag/` (the `ccc-data` Docker volume).
