# Spec 0027: Command center HUD overview

**Status:** Draft (proposed)
**Owner:** TJ
**Date:** 2026-06-12
**Decision record:** none (reversible layout choice)

Implementation follows the karpathy-guidelines skill.

## Context

The dashboard has 18 routes. Live state that an operator wants at a glance
(running sessions, queue depth, recent grades, the event stream, capacity) is
spread across `/issues`, `/inbox`, `/sessions`, `/evals`, and `/analytics`. The
landing (`app/page.tsx`) is a project list with a thin `RunningSessionsStrip`.
There is no single mission-control screen.

The planning docs proposed `react-grid-layout` for draggable, resizable panels.
For one operator who will not rearrange their own cockpit daily, that adds a
dependency plus layout-persistence state for flexibility nobody asked for, which
the karpathy "no unrequested flexibility" rule rejects. The pieces already exist
as components; this is assembly, not new infrastructure.

## Decisions

1. **Fixed dense overview as the landing.** Restructure `app/page.tsx` into a
   fixed responsive grid (CSS grid / Tailwind, no new layout library). The
   existing project list moves into one pane of the overview, so nothing is
   lost.
2. **Reuse existing components and data hooks.** Panes are composed from what
   ships today: `RunningSessionsStrip` (active runs), kanban issue cards from
   `/issues`, the inbox summary (`app/inbox`), and capacity + recent-grade
   readouts from the evals and analytics queries. The SSE event stream
   (`lib/stream.ts`, consumed via the existing `useSSE` hook) drives a live
   activity feed pane.
3. **No new charting dependency.** Telemetry readouts reuse the hand-rolled SVG
   approach from ADR-013 / ADR-015. `recharts` stays deferred behind its own
   future ADR, exactly as those decisions state.
4. **Five panes, fixed positions.** Running sessions, global event stream,
   queue / kanban snapshot, inbox + interrupted flags (Spec 0024), and a
   capacity + latest-grades strip. The per-domain routes remain the place for
   depth; the HUD is the at-a-glance layer and links into them.

## Files

- `app/page.tsx`: recompose into the fixed grid overview.
- `components/home/`: add small presentational panes
  (`OverviewQueuePane.tsx`, `OverviewEventStream.tsx`, `OverviewCapacity.tsx`),
  each wrapping existing hooks/queries. Reuse `RunningSessionsStrip` and
  `ProjectCard` as-is.
- No changes to `lib/`; the panes consume existing read paths and SSE.

## UI

Fixed grid, dark theme consistent with `standards/dashboard-ui.md`. Top strip:
running sessions. Left column: queue/kanban snapshot and projects. Right column:
live event stream. Bottom strip: capacity and latest grades. Each pane has a
header that links to its full route.

## Acceptance / tests

1. The landing renders all five panes with live data and degrades cleanly when a
   pane has nothing (empty states), reusing `components/common/EmptyState`.
2. No new runtime dependency is added to `dashboard/package.json`.
3. The event-stream pane updates from the existing SSE bus without a manual
   refresh (assert via the SSE test seam used in `tests/stream.test.ts`).

## Out of scope

Draggable or resizable panels, per-user saved layouts, and any new chart library.
Rejected above; revisit only if a second operator or a real layout need appears.
