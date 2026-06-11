# Development Guide — Claude Control Center

## Prerequisites

| Tool | Version |
|---|---|
| Python | 3.11+ |
| Node.js | 20+ |
| npm | 10+ |
| Docker Engine | 24+ (optional, for production testing) |

---

## Local setup

### 1. Clone the repository

```sh
git clone https://github.com/your-username/claude-control-center.git
cd claude-control-center
```

### 2. Backend

```sh
cd backend
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
```

Edit `backend/.env` to point `CLAUDE_DIR` at your `~/.claude` directory (default is auto-detected). Set `CODEX_DIR` if you use Codex CLI.

Start the development server:

```sh
python run.py
```

The API is now running at `http://localhost:5050`.

### 3. Frontend

In a separate terminal:

```sh
cd frontend
npm install
npm run dev
```

The UI is available at `http://localhost:5173`. Vite proxies all `/api/*` requests to the backend on port 5050, so you can develop both sides independently.

---

## Project structure

```
.
├── backend/
│   ├── app/
│   │   ├── __init__.py          # Application factory, security middleware
│   │   ├── config.py            # Environment variable loading
│   │   ├── routes/              # Flask blueprints, one per feature domain
│   │   └── services/            # Business logic, filesystem I/O
│   ├── data/                    # JSON caches written by background scanners
│   ├── .env.example             # Environment variable template
│   ├── requirements.txt
│   └── run.py                   # Dev server entry point
│
├── frontend/
│   ├── src/
│   │   ├── api/                 # Typed fetch wrappers, one file per domain
│   │   ├── components/          # Reusable UI components
│   │   │   ├── agents/
│   │   │   ├── conversation/
│   │   │   ├── icons/
│   │   │   ├── layout/
│   │   │   ├── memory/
│   │   │   ├── plans/
│   │   │   └── settings/
│   │   ├── hooks/               # React Query hooks and useSSE
│   │   ├── pages/               # One component per route
│   │   ├── store/               # Zustand UI state
│   │   ├── types/               # Shared TypeScript interfaces
│   │   ├── lib/utils.ts         # cn(), relativeTime(), formatTokens(), …
│   │   ├── index.css            # CSS custom properties and component classes
│   │   └── App.tsx              # Route definitions
│   ├── index.html               # Google Fonts, app entry point
│   ├── tailwind.config.ts       # Design tokens
│   ├── vite.config.ts           # Dev server proxy, build config
│   └── package.json
│
├── docs/                        # Documentation
├── qmd-examples/                # QMD runner example scripts
├── tools/qmd-runner.mjs         # QMD runner implementation
├── docker-compose.yml
├── Dockerfile
└── start.sh
```

---

## Adding a new feature

The typical pattern for a new feature is:

### 1. Backend route

Create `backend/app/routes/my_feature.py`:

```python
from flask import Blueprint, jsonify

bp = Blueprint("my_feature", __name__, url_prefix="/api/my-feature")

@bp.get("")
def list_items():
    return jsonify([])
```

Register the blueprint in `backend/app/__init__.py`:

```python
from app.routes.my_feature import bp as my_feature_bp
# ...
app.register_blueprint(my_feature_bp)
```

### 2. Backend service (if needed)

Add business logic in `backend/app/services/my_feature_service.py` and import it from the route. Keep route files thin — they should only parse request data, call services, and format responses.

### 3. Frontend API client

Create `frontend/src/api/myFeature.ts`:

```typescript
import { apiFetch } from './client';

export async function listItems(): Promise<MyItem[]> {
  return apiFetch('/api/my-feature');
}
```

For mutating requests, include the CSRF header via `apiFetch` (it is added automatically for non-GET methods by `client.ts`).

### 4. Frontend hook

Create `frontend/src/hooks/useMyFeature.ts`:

```typescript
import { useQuery } from '@tanstack/react-query';
import { listItems } from '../api/myFeature';

export function useMyFeature() {
  return useQuery({ queryKey: ['my-feature'], queryFn: listItems });
}
```

### 5. Page component

Create `frontend/src/pages/MyFeaturePage.tsx` and add a route in `App.tsx`:

```tsx
<Route path="/my-feature" element={<MyFeaturePage />} />
```

Add a nav link in `frontend/src/components/layout/Sidebar.tsx`.

---

## Conventions

### Backend

- One blueprint per feature domain. Avoid putting logic for two different domains in the same route file.
- Services read from `CLAUDE_DIR` / `CODEX_DIR` (imported from `app.config`). Do not hardcode paths.
- Cache files written to `backend/data/` must be written atomically using a `.tmp` → `os.replace()` pattern to prevent partial reads.
- Background threads should be daemon threads (set `daemon=True`) so they don't block process exit.
- Use `orjson` for JSON serialisation — it is significantly faster than the stdlib `json` module for large JSONL files.

### Frontend

- Components in `src/components/` are generic and reusable. Page-specific logic belongs in `src/pages/`.
- Use the `cn()` utility from `src/lib/utils.ts` for conditional class names.
- All colors used in Chart.js must be plain hex or rgba strings — CSS variables and `oklch()` are not supported by the canvas renderer. Use the constants defined at the top of `AnalyticsPage.tsx` as a reference.
- Prefer named exports for all components and hooks.
- TanStack Query is the source of truth for server state. Do not shadow it with local `useState`.

### Styling

- Use CSS custom properties defined in `src/index.css` for colors, not raw Tailwind palette classes (e.g., use `text-[var(--text-secondary)]` not `text-gray-400`).
- Component utility classes (`.card`, `.chip`, `.btn-primary`, `.input-field`, etc.) are defined in `src/index.css` under `@layer components`. Use them before reaching for one-off Tailwind compositions.
- Border radius tokens are overridden in `tailwind.config.ts` to keep corners sharp (2–4 px). Do not use `rounded-2xl` or higher.

---

## Running quality checks

There are no automated test suites at present. Use the QMD runner to run common dev checks:

```sh
./qmd run qmd-examples/dev-checks.qmd
```

Type checking (frontend):

```sh
cd frontend && npx tsc --noEmit
```

Production build check:

```sh
cd frontend && npm run build
```

---

## Building the Docker image

```sh
docker compose build
docker compose up -d
```

Verify the container is healthy:

```sh
docker compose ps
docker compose logs -f
```

The full rebuild takes approximately 2–3 minutes on first run. Subsequent rebuilds with cached layers typically take under 30 seconds when only source files change.

---

## Environment variables

| Variable | Purpose | Required |
|---|---|---|
| `CLAUDE_DIR` | Path to `~/.claude` | No (defaults to `~/.claude`) |
| `CODEX_DIR` | Path to `~/.codex` | No (defaults to `~/.codex`) |
| `PORT` | Server port | No (defaults to `5050`) |
| `CORS_ORIGIN` | Allowed CORS origin | No (defaults to `http://localhost:5173`) |
| `ANTHROPIC_API_KEY` | Anthropic API key | Only for Managed Agents |
| `MANAGED_AGENTS_BASE_URL` | Anthropic API base URL | No |

---

## Contributing

1. Fork the repository and create a branch from `main`.
2. Make your changes following the conventions above.
3. Confirm the frontend builds without TypeScript errors: `cd frontend && npm run build`.
4. Confirm the backend starts cleanly: `cd backend && python run.py`.
5. Open a pull request with a clear description of what changed and why.

For significant changes — new pages, new API domains, architecture changes — open an issue first to discuss the approach before investing time in implementation.
