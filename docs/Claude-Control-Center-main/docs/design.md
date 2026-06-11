# Claude Control Center — Design Document

> **Status**: Draft  
> **Last updated**: 2026-04-16  
> **Author**: Ruwindhu Hettige Don

---

## 1. Overview

Claude Control Center is a self-hosted web dashboard for inspecting, managing, and analysing activity from [Claude Code](https://claude.ai/code) — Anthropic's CLI tool. It reads the `~/.claude` directory directly, presenting conversations, memory, plans, tasks, analytics, managed agents, and more through a single unified UI.

The application is intended for individual developers or small teams who run Claude Code locally and want visibility into their sessions, costs, token usage, and automation routines beyond what the CLI exposes.

### Goals

- Provide a real-time window into running and historical Claude Code sessions
- Surface usage analytics and cost estimates with no manual data export
- Manage Claude Code configuration (settings, plugins, skills, commands) through a GUI
- Run and monitor managed agents via the Anthropic SDK
- Give advisors and Codex integrations a persistent home outside the terminal

### Non-goals

- Multi-user auth or team access control (single-user self-hosted tool)
- Modifying conversation history or memory records on behalf of Claude
- Acting as a Claude Code replacement — it observes and manages, does not execute

---

## 2. Architecture

### High-level

```
Browser
  └── React SPA (Vite + TypeScript)
        ├── REST calls  ──────────────────┐
        └── SSE stream  ─────────────────┐│
                                         ││
                               Flask API (Python)
                                         │
                               ~/.claude  (read-only mount)
                               backend/.env (ANTHROPIC_API_KEY, etc.)
```

The backend is a **Python Flask** application that reads the `~/.claude` filesystem (JSONL conversation files, memory stores, plan files, task locks) and exposes them as a REST + SSE API. The frontend is a **React SPA** that talks exclusively to this API.

### Deployment

The application ships as a single Docker image that serves both the compiled frontend static assets and the Flask API on **port 5050**. By default the port is bound to `127.0.0.1` only (localhost).

```
docker compose up -d
# → http://localhost:5050
```

Key Docker environment variables:

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `5050` | HTTP port |
| `CLAUDE_DIR` | `/data/claude` | Mount path for `~/.claude` |
| `CORS_ORIGIN` | `http://localhost:5050` | Allowed CORS origin |
| `ANTHROPIC_API_KEY` | _(empty)_ | Required for managed agents |

Resource limits: 0.5 CPU, 384 MB RAM.

---

## 3. Tech Stack

### Frontend

| Layer | Library / Version |
|---|---|
| Framework | React 18 |
| Language | TypeScript |
| Build tool | Vite 6 |
| Styling | Tailwind CSS v3 |
| Routing | React Router v6 |
| Server state | TanStack Query (React Query) v5 |
| Charts | Chart.js + react-chartjs-2 |
| Icons | Lucide React |
| Code editor | CodeMirror 6 |
| UI primitives | Radix UI (Tabs) |
| Real-time | Server-Sent Events (SSE) via `useSSE` hook |

### Backend

| Layer | Library |
|---|---|
| Framework | Python Flask |
| Agent SDK | Anthropic Python SDK (managed agents) |
| File watching | `watchdog` |
| JSONL parsing | Custom `jsonl_parser` service |

---

## 4. Design System

### 4.1 Brand personality

Three words: **dense, uncompromising, exact.**

The aesthetic reference is precision engineering documentation — mainframe terminal manuals, instrument panel labels, mission-critical dashboards. Not retro nostalgia; current and sharp. Bold enough to have personality, restrained enough to stay out of the way during real work.

### 4.2 App icon

The application icon is a `>█` terminal prompt symbol: a sharp chevron followed by a solid cursor block. No rounded corners. Component: `src/components/icons/AppIcon.tsx`.

```
> █
```

### 4.3 Color system

All colors are defined in CSS custom properties using **OKLCH** (perceptually uniform). Tailwind classes extend from these tokens.

**Base palette**

| Token | Value | Role |
|---|---|---|
| `--bg-base` | `oklch(11% 0.010 215)` | Page background |
| `--bg-sidebar` | `oklch(13% 0.011 215)` | Sidebar surface |
| `--bg-card` | `oklch(15.5% 0.011 215)` | Card background |
| `--bg-card-hover` | `oklch(17.5% 0.012 215)` | Card hover state |

All backgrounds are subtly tinted toward the accent hue (H=215) for subconscious palette cohesion.

**Accent — vivid teal**

| Token | Value | Role |
|---|---|---|
| `--accent` | `oklch(71% 0.185 192)` | Primary accent color |
| `--accent-bright` | `oklch(77% 0.185 192)` | Hover / emphasis |
| `--accent-dim` | `oklch(71% 0.185 192 / 0.12)` | Chip backgrounds, active nav |
| `--accent-dim-strong` | `oklch(71% 0.185 192 / 0.20)` | Stronger tint where needed |
| `--border-hover` | `oklch(71% 0.185 192 / 0.45)` | Card/input hover borders |

The accent was chosen to replace the ubiquitous AI-purple (`#6366f1`) with something precise, rare in developer tooling, and unambiguous at low saturation.

**Text**

| Token | Value | Role |
|---|---|---|
| `--text-primary` | `oklch(92% 0.008 230)` | Headings, values, labels |
| `--text-secondary` | `oklch(60% 0.016 230)` | Body text, descriptions |
| `--text-tertiary` | `oklch(38% 0.010 230)` | Timestamps, metadata, placeholders |

**Status**

| Token | Value | Role |
|---|---|---|
| `--success` | `oklch(70% 0.17 145)` | Live sessions, completed states |
| `--success-dim` | `oklch(70% 0.17 145 / 0.10)` | Success chip background |
| `--success-border` | `oklch(70% 0.17 145 / 0.20)` | Success chip border |
| `--error` | `oklch(62% 0.22 25)` | Error states |
| `--warning` | `oklch(72% 0.17 70)` | Warning callouts |

### 4.4 Typography

**Font stack**

| Role | Family | Weights | Usage |
|---|---|---|---|
| Display | Big Shoulders Display | 700, 800, 900 | Sidebar brand mark, section labels, prose `<h1>`/`<h2>` |
| Body | Chivo | 300, 400, 500, 700 | All UI text, descriptions, labels |
| Mono | Chivo Mono | 400, 500 | Code blocks, file paths, terminal output |

All fonts are loaded from Google Fonts via `<link>` in `index.html`.

**Type scale**

The UI uses a fixed `rem`-based scale (not fluid/`clamp`) appropriate for a dense dashboard:

| Step | Size | Usage |
|---|---|---|
| xs | 11px | Timestamps, metadata |
| sm | 12px | Chip labels, secondary info |
| base | 14px | Body default |
| md | 15–16px | Section headings, nav labels |
| lg–xl | 17–20px | Page titles (Big Shoulders Display) |

**Hierarchy rules**

- Minimum 1.25× ratio between adjacent scale steps
- Big Shoulders Display at 800 weight for brand mark and prose headings — the condensed width creates dramatic size contrast without needing extreme size increases
- `letter-spacing: -0.01em` on display text; `letter-spacing: 0.04–0.10em` on uppercase labels

### 4.5 Shape & spacing

**Border radius** — overridden globally in `tailwind.config.ts`:

| Tailwind token | Value |
|---|---|
| `rounded-sm` | 2px |
| `rounded` / `rounded-md` / `rounded-lg` | 3px |
| `rounded-xl` | 4px |
| `rounded-full` | 9999px |

No large rounded rectangles. Sharp corners reinforce the "uncompromising, exact" brand tone.

**Spacing** — standard 4pt scale via Tailwind defaults. Sidebar and page content use `px-4 py-4` / `p-6` as the main rhythm units.

### 4.6 Component classes

Defined in `src/index.css` under `@layer components`:

| Class | Description |
|---|---|
| `.card` | Standard surface container. Thin border, 3px radius, hover teal border tint |
| `.chip` | Inline label/badge. 2px radius, 2px vertical / 8px horizontal padding |
| `.btn-primary` | Filled teal CTA button |
| `.btn-secondary` | Ghost button with border |
| `.input-field` | Text input with teal focus ring |
| `.sidebar-nav-link` | Nav item. Active state: teal background tint + teal text |
| `.skeleton` | Shimmer loading placeholder |
| `.prose-dark` | Markdown content renderer (conversations, changelog, plans) |

### 4.7 Motion

| Class | Keyframe | Usage |
|---|---|---|
| `.animate-fade-in` | `opacity 0→1, translateY 4px→0` | Page/list entry |
| `.animate-slide-in-right` | `opacity 0→1, translateX 20px→0` | Drawer entry |
| `.animate-pulse-dot` | Opacity pulse (0.3–1.0) | Live session indicator dots |
| `.animate-cursor-blink` | Step opacity blink | App icon cursor (optional) |

Easing: `ease` (cubic-bezier default) for entrances. No bounce or elastic curves.

---

## 5. Page & Route Map

| Route | Page component | Description |
|---|---|---|
| `/conversations` | `ConversationsPage` | Project list — all Claude Code projects |
| `/conversations/:projectId` | `SessionListPage` | Sessions within a project |
| `/conversations/:projectId/:sessionId` | `MessageThreadPage` | Full message thread with tool call blocks |
| `/memory` | `MemoryPage` | Global Claude memory entries |
| `/memory/:projectId` | `ProjectMemoryPage` | Project-scoped memory |
| `/plans` | `PlansPage` | Plan files (markdown) with live editor |
| `/tasks` | `TasksPage` | Active task lock files |
| `/settings` | `SettingsPage` | Claude Code settings, plugins, skills, commands |
| `/history` | `HistoryPage` | Session history log |
| `/analytics` | `AnalyticsPage` | Token usage, activity, models, projects + Codeburn cost tab |
| `/codex` | `CodexPage` | Codex usage log |
| `/advisor` | `AdvisorPage` | Advisor call history |
| `/agents` | `AgentsPage` | Managed agents (Anthropic SDK) |
| `/agents/sessions/:sessionId` | `AgentSessionPage` | Live agent session event stream |
| `/changelog` | `ChangelogPage` | Claude Code release changelog + What's New |
| `/routines` | `RoutinesPage` | Scheduled automation routines |

Default redirect: `/` → `/conversations`

---

## 6. Backend API

All routes are prefixed relative to the Flask app root (no `/api` prefix).

### Sessions & Conversations

| Method | Path | Description |
|---|---|---|
| `GET` | `/sessions` | List active Claude Code sessions |
| `GET` | `/conversations` | List all projects |
| `GET` | `/conversations/:id` | List sessions for a project |
| `GET` | `/conversations/:id/:session` | Full message thread |

### Memory

| Method | Path | Description |
|---|---|---|
| `GET` | `/memory` | All global memory entries |
| `GET` | `/memory/:project` | Project-scoped memory |
| `POST` | `/memory` | Create memory entry |
| `PUT` | `/memory/:id` | Update memory entry |
| `DELETE` | `/memory/:id` | Delete memory entry |

### Plans

| Method | Path | Description |
|---|---|---|
| `GET` | `/plans` | List plan files |
| `GET` | `/plans/:slug` | Read a plan file |
| `PUT` | `/plans/:slug` | Save a plan file |

### Tasks, History, Settings, Plugins, Skills, Commands

Standard CRUD endpoints in `routes/tasks.py`, `routes/history.py`, `routes/settings.py`, `routes/plugins.py`, `routes/skills.py`, `routes/commands.py`.

### Analytics

| Method | Path | Description |
|---|---|---|
| `POST` | `/analytics/scan` | Trigger JSONL scan and return stats |
| `GET` | `/analytics/stats` | Cached analytics stats |
| `GET` | `/analytics/codeburn` | Cost estimates via Codeburn service |

### Managed Agents

| Method | Path | Description |
|---|---|---|
| `GET` | `/agents` | List managed agents |
| `POST` | `/agents` | Create agent |
| `GET` | `/agents/environments` | List environments |
| `POST` | `/agents/sessions` | Start agent session |
| `GET` | `/agents/sessions/:id` | Session detail |
| `GET` | `/agents/sessions/:id/events` | SSE event stream |

### Real-time

| Method | Path | Description |
|---|---|---|
| `GET` | `/sse` | Server-Sent Events stream for live session updates |

### Changelog & Routines

Endpoints in `routes/changelog.py` and `routes/routines.py` for What's New entries and scheduled routine management.

---

## 7. Key Frontend Services

### `useSSE` hook (`src/hooks/useSSE.ts`)

Maintains a persistent SSE connection to `/sse`. The sidebar's live indicator dot reflects `connected` state. Components subscribe to specific event types.

### `useActiveSessions` hook

Polls the sessions endpoint; filters for `isAlive === true`. Used by the sidebar active sessions panel and `ActiveSessionBadge`.

### Analytics + Codeburn (`src/api/analytics.ts`)

`DaysRange` type: `7 | 30 | 90 | 'all'`. Stats are cached via React Query with a 5-minute stale time. `triggerAnalyticsScan()` forces a fresh JSONL parse.

Chart.js constants must use plain hex/rgba values (not CSS variables or oklch) — see `ACCENT = '#0ecbbe'` and `GREEN = '#3ec85e'` at the top of `AnalyticsPage.tsx`.

### Managed Agents (`src/api/agents.ts`)

Requires `ANTHROPIC_API_KEY` set in `backend/.env`. The `useAgentStatus` hook checks key presence; `AgentsPage` shows a warning banner when absent.

---

## 8. File Structure

```
.
├── frontend/
│   ├── index.html                  # Google Fonts import, app entry
│   ├── tailwind.config.ts          # Design tokens (colors, fonts, radii)
│   ├── src/
│   │   ├── index.css               # CSS custom properties, component classes
│   │   ├── App.tsx                 # Route definitions
│   │   ├── components/
│   │   │   ├── icons/
│   │   │   │   └── AppIcon.tsx     # >█ terminal prompt SVG icon
│   │   │   ├── layout/
│   │   │   │   ├── AppShell.tsx    # Root layout (Sidebar + Outlet)
│   │   │   │   ├── Sidebar.tsx     # Nav, brand mark, active sessions
│   │   │   │   └── ActiveSessionBadge.tsx
│   │   │   ├── conversation/       # MessageThread, ProjectList, SessionList, ToolCallBlock
│   │   │   ├── memory/             # MemoryCard, MemoryEditor, MemoryList
│   │   │   ├── plans/              # PlanList, PlanViewer
│   │   │   ├── settings/           # SettingsEditor, PluginList, CommandList, SkillList
│   │   │   └── agents/             # AgentCard, AgentForm, SessionCard, SessionEventStream
│   │   ├── pages/                  # One file per route
│   │   ├── hooks/                  # useSSE, useProjects, useAgents, useSettings, …
│   │   ├── api/                    # Typed fetch wrappers per domain
│   │   ├── store/                  # uiStore (Zustand)
│   │   ├── types/                  # Shared TypeScript types
│   │   └── lib/utils.ts            # cn(), relativeTime(), shortPath(), formatTokens()
│
├── backend/
│   ├── run.py                      # Flask app entry
│   └── app/
│       ├── routes/                 # One file per feature domain
│       └── services/               # jsonl_parser, memory_service, watcher, project_decoder
│
├── docs/
│   ├── design.md                   # This document
│   ├── advisor/                    # Advisor usage guides
│   └── agents/                     # Agent configuration templates
│
├── docker-compose.yml
├── Dockerfile
└── start.sh
```

---

## 9. Design Decisions & Rationale

### Why Flask over FastAPI?

The backend does mostly filesystem I/O (reading JSONL files, watching directories). Flask's simplicity and low overhead suits a single-user local tool. FastAPI's async capabilities are not needed at this scale.

### Why SSE over WebSockets?

One-way push from server to browser is sufficient for live session updates. SSE is simpler to implement, natively supported by browsers, and works cleanly through reverse proxies without upgrade negotiation.

### Why Tailwind + CSS custom properties instead of a component library?

Full design control without fighting an upstream component library's opinions. CSS variables allow runtime theming and give Chart.js its hex fallbacks while keeping the design system single-source-of-truth.

### Why OKLCH for colors?

Perceptual uniformity: equal lightness steps _look_ equal, unlike HSL. This makes it easier to create consistent hover/focus/dim variants without manual tweaking. All modern browsers (2023+) support `oklch()` natively.

---

## 10. Open Items / TODO

> These are areas that still need decisions or further design work.

- [ ] **Mobile layout** — currently desktop-only (fixed 240px sidebar). Responsive strategy not defined.
- [ ] **Light mode** — dark-only. Light mode variants for `--bg-*` and `--text-*` tokens not planned but possible.
- [ ] **Accessibility audit** — WCAG 2.1 AA target. Focus rings and keyboard navigation need review, particularly in the agent session event stream and code editor surfaces.
- [ ] **Error boundaries** — no global React error boundary. Individual pages handle loading/error states inconsistently.
- [ ] **Auth** — no authentication layer. Appropriate for localhost; would need attention before any LAN/remote exposure.
- [ ] **Analytics scan performance** — full JSONL scan triggered on every page load. Consider incremental indexing for large `~/.claude` directories.
- [ ] **Changelog page** — What's New data source not yet documented (where does this content come from?).
- [ ] **Font fallback** — if Google Fonts is unavailable (offline/airgapped), the UI falls back to `system-ui`. Fallback appearance should be reviewed.
