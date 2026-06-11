# GEMINI.md - Claude Control Center

This file provides foundational guidance for the Claude Control Center repository. It outlines the project's purpose, architecture, development workflows, and coding standards to ensure consistent and efficient development.

## Project Overview
Claude Control Center is a self-hosted web dashboard for monitoring, managing, and analyzing [Claude Code](https://claude.ai/code) activity. It operates by reading `~/.claude` and `~/.codex` directories directly, requiring no external database or cloud account.

### Main Technologies
- **Frontend:** React 19, TypeScript, Vite 8, Tailwind CSS v4, TanStack Query v5, Chart.js.
- **Backend:** Python 3.11, Flask, orjson, watchdog, httpx.
- **Real-time:** Server-Sent Events (SSE).
- **Deployment:** Docker, Gunicorn.

### Core Architecture
- **Data Source:** Direct filesystem access to `~/.claude` and `~/.codex`.
- **Backend:** Flask factory pattern (`backend/app/__init__.py:create_app()`). Thin routes, heavy service layer (`backend/app/services/`). Background threads for data scanning and caching to `backend/data/`.
- **Frontend:** Single Page Application (SPA). Domain-driven organization in `src/api/`, `src/hooks/`, `src/pages/`, and `src/components/`.

---

## Building and Running

### Development Setup
You should run the backend and frontend in separate terminals.

**Backend:**
```sh
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # Edit CLAUDE_DIR / CODEX_DIR if needed
python run.py                 # Runs on http://localhost:5050
```

**Frontend:**
```sh
cd frontend
npm install
npm run dev                   # Runs on http://localhost:5173 (proxies /api to :5050)
```

### Production (Docker)
```sh
docker compose up -d --build  # Runs on http://localhost:5050
```

### Testing & Quality Checks
- **Frontend Type-check:** `npm run typecheck` (or `npx tsc --noEmit` in `frontend/`)
- **Frontend Build:** `npm run build`
- **QMD Runner (Custom tool):** `./qmd run qmd-examples/dev-checks.qmd`

---

## Development Conventions

### General
- **No Database:** Persistent state lives in the user's existing directories. Only write to these for memory edits, plans, settings, or agent library.
- **Localhost-Only:** The project has no authentication layer. Security relies on binding to `127.0.0.1`.

### Backend (Python/Flask)
- **Domain Blueprints:** One blueprint per feature in `backend/app/routes/`. Register in `backend/app/__init__.py`.
- **Service Layer:** All business logic and filesystem I/O belongs in `backend/app/services/`.
- **Atomic Writes:** Cache writes must use the `.tmp` → `os.replace()` atomic pattern.
- **JSON:** Use `orjson` for performance with large JSONL files.
- **SSE:** Events are managed via the `Watcher` service and polled/pushed via `backend/app/routes/sse.py`.

### Frontend (React)
- **State Management:** Use TanStack Query for server state and Zustand for global UI state. Do not shadow server state with local `useState`.
- **Styling:** Use CSS custom properties from `src/index.css` (Tailwind v4 theme variables). Avoid raw Tailwind palette classes for theme-specific colors.
- **Charts:** Chart.js colors must be plain hex or rgba (CSS variables/oklch not supported in canvas).
- **Components:** Named exports for all components and hooks. Reusable components in `src/components/`, page-specific logic in `src/pages/`.

### Adding a New Feature
1. Create a Flask blueprint in `backend/app/routes/`.
2. Register the blueprint in `backend/app/__init__.py`.
3. Implement business logic in `backend/app/services/`.
4. Create a typed fetch wrapper in `frontend/src/api/`.
5. Create a TanStack Query hook in `frontend/src/hooks/`.
6. Create a page component in `frontend/src/pages/`.
7. Register the route in `App.tsx` and add a nav link in `Sidebar.tsx`.
