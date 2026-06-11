# Dashboard UI standard

> Applies to `dashboard/` (the live app).

## App shell

A persistent left nav sidebar plus a full-width content pane:

```
192px (NavSidebar, sticky, h-screen) | 1fr (page content)
```

- `components/shell/AppShell.tsx` wraps every page via `app/layout.tsx`.
- `components/shell/NavSidebar.tsx` owns the nav items: Dashboard, Issues,
  Inbox, Agents, Skills, Graph, Runtimes, Connections, Settings.
- Active item: prefix match on the pathname (`/` requires exact match).
- Pages own their inner width: `max-w-5xl` for list/detail views,
  `max-w-7xl` for boards, `max-w-2xl` for forms, with `mx-auto p-6`.

## Components

- Shared primitives live in `components/common/`: `Button` (variants
  `primary`, `ghost`), `Modal`, `Drawer`, `Field`/`Input`/`Textarea`,
  `EmptyState`, `RuntimeBadge`.
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

Tailwind utility classes with explicit `dark:` variants (the codebase does
not use shadcn token variables). Grays for chrome, one accent per meaning:
green (running/ok), red (error/failed), yellow (priority), blue (action),
purple (project chip), orange (claude), blue (gemini). Never hex values in
components.

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
