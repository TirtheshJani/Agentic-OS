# Dashboard UI standard

## Layout grid

Three-column, full-viewport:

```
280px (skills rail) | 1fr (prompt + output) | 320px (right rail)
```

CSS:

```css
.app-grid {
  display: grid;
  grid-template-columns: 280px 1fr 320px;
  gap: 1rem;
  min-height: 100dvh;
}
```

## Components

- **Cards** — `Card` from shadcn/ui for every panel. Header with title and
  optional `Badge`. No card without a clear single purpose.
- **Output stream** — `ScrollArea` wrapping a `<pre>`. Auto-scroll on new
  content unless the user has scrolled up.
- **Status badges** — `Badge` variants: `default` (running), `secondary`
  (stub skill), `outline` (queued), `destructive` (error), custom green
  (done).
- **Buttons** — `Button` with `variant="default"` for primary (Run),
  `"secondary"` for navigation, `"ghost"` for inline actions.

## Color tokens

Defined once in `app/globals.css` as Tailwind v4 CSS variables. Components
reference tokens (`bg-card`, `text-muted-foreground`), never hex values.

## States

Every panel must handle: **empty** (no data yet), **loading** (skeleton),
**error** (red badge + retry), and **populated**. No flicker on transitions.

## Streaming

The output panel consumes Server-Sent Events from `/api/run`. Each event
type renders differently:

- `delta` — appended to the running text.
- `tool` — collapsed pill ("Used: WebFetch").
- `done` — green status, final word count.
- `error` — red status, full error.

## Accessibility

- All interactive elements reachable by keyboard.
- `aria-live="polite"` on the output panel.
- Run button shows a spinner via `aria-busy="true"` while a run is active.
- Color is never the only signal; pair with text or icon.
