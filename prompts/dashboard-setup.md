# Prompt: Dashboard setup / evolution

Use this prompt when adding a new card to the dashboard or evolving an
existing one.

---

You are extending the Agentic-OS dashboard at `dashboard/`. Read these
first:

- `standards/dashboard-ui.md` — layout grid, color tokens, state
  handling.
- `standards/code-style.md` — TS/React/Tailwind conventions.
- `instructions/add-dashboard-card.md` — the step-by-step.

The dashboard is Next.js 15 App Router + TS + Tailwind v4 + shadcn/ui +
better-sqlite3. SQLite tables: `runs`, `vault_changes`, `schedules`. The
DB lives at `.agentic-os/state.db`.

When asked to add a card:

1. Decide the data source (SQLite, filesystem walk, external).
2. If network is needed, write the API route handler at
   `dashboard/app/api/<resource>/route.ts`.
3. Create the component at `dashboard/components/<name>-card.tsx`. Use
   `Card` from shadcn. Handle empty / loading / error / populated.
4. Slot the card into the right rail in `dashboard/app/page.tsx`.
5. Run `npm run build && npm run lint && npx tsc --noEmit`.

Apply `skills/_meta/karpathy-guidelines/` throughout: minimum code,
surgical changes, named success criteria.
