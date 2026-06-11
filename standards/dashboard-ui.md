# Dashboard UI standard

> Applies to `dashboard/` (the live app).

## App shell

A persistent left nav sidebar plus a full-width content pane:

```
192px (NavSidebar, sticky, h-screen) | 1fr (page content)
```

- `components/shell/AppShell.tsx` wraps every page via `app/layout.tsx`.
- `components/shell/NavSidebar.tsx` owns the nav items: Dashboard, New
  Project, Issues, Inbox, Agents, Skills, Graph, Runtimes, Connections,
  Settings.
- Active item: prefix match on the pathname (`/` requires exact match).
- Pages own their inner width: `max-w-5xl` for list/detail views,
  `max-w-7xl` for boards, `max-w-2xl` for forms, with `mx-auto p-6`.

## Components

- Shared primitives live in `components/common/`: `Button` (variants
  `primary`, `secondary`, `ghost`, `danger`), `Modal`, `Drawer`,
  `Field`/`Input`/`Textarea`, `EmptyState`, `RuntimeBadge`, plus the
  design-system primitives `Card`, `Pill`, `StatusDot`, `Switch`,
  `SectionHeader`, `StatCard`.
- Domain components group by feature folder: `project/` (kanban),
  `issue/` (drawer, runs, terminal), `home/`, `shell/`.
- **Kanban** — `project/KanbanBoard.tsx` with @dnd-kit. Five columns:
  Backlog, Queued, Running, Review, Done. The same component serves the
  per-project board (`projectSlug` set) and the global `/issues` board
  (no `projectSlug`; cards add a project chip and a quick-assign select).
- **Terminal** — `issue/RunTerminal.tsx`, xterm.js over a WebSocket to the
  PTY. xterm must be imported dynamically inside `useEffect` (it references
  `self` at module scope and breaks SSR otherwise).
- **RuntimeBadge** — shown wherever an agent or run appears. Unknown
  runtime ids render the raw id in gray; capability-gated features default
  off for unknown runtimes.

## Color and dark mode

Design tokens (from `docs/designs/Agentic OS.dc.html`) as CSS variables in
`app/globals.css`: light on `:root`, dark overrides on
`[data-theme="dark"]`. Tailwind maps them in `tailwind.config.ts`:

- Backgrounds: `bg-canvas` (page), `bg-surface` (cards), `bg-surface2`
  (chrome fills), `bg-raise` (lifted panels).
- Borders: `border-line` (default), `border-line2` (inputs/emphasis).
- Text: `text-ink` / `text-ink2` / `text-ink3` (primary/secondary/muted).
- Semantic: `accent` (+ `accent-ink`, `accent-bg`, `accent-line`), `ok`
  (+ `ok-bg`), `danger` (+ `danger-bg`).
- Fonts: `font-display` (Playfair Display, headings), `font-sans`
  (Montserrat, body), `font-label` (Oswald, uppercase labels/pills).
- `rounded-card` (12px), `shadow-card` / `shadow-card-lg`.

Dark mode is selector-based (`darkMode: ["selector", '[data-theme="dark"]']`);
a pre-hydration script in `app/layout.tsx` sets `data-theme` from
`localStorage.theme`, falling back to the OS preference. Var-backed colors
do not support `/opacity` modifiers; use the `*-bg` rgba tokens. Never hex
values in components; legacy `dark:` classes are tolerated only on views
not yet migrated to tokens.

## States

Every view handles: **empty** (`EmptyState` with a one-line hint),
**loading** (short gray text or skeleton), **error** (red text inline), and
**populated**. No flicker on transitions.

## Live updates

- Server push: `GET /api/stream` (SSE) with events `project.changed`,
  `agent.changed`, `issue.changed`, `thread.appended`. Client hooks
  (`useIssues`, `useProjects`, `useStream`) reload on relevant events.
- Terminals stream raw PTY bytes over `ws://.../api/runtime/socket/:runId`.
- Capability-gated UI (open-in-terminal, future events/cost surfaces)
  consults `/api/runtimes` via `useRuntimes`/`useRuntime`.

## Accessibility

- All interactive elements reachable by keyboard.
- Drag-and-drop has a click path too: status changes also work from the
  issue drawer; assignment from the card select.
- Color is never the only signal; pair with text or icon.
