# Add a dashboard card

The right rail is composed of small, single-purpose cards. To add one:

1. **Decide the data source.** Pick one:
   - SQLite (`runs`, `vault_changes`, `schedules`) — query via
     `lib/db.ts`.
   - Filesystem walk (e.g. `automations/remote/*.md`) — use
     `lib/paths.ts`.
   - External — fetched server-side in a route handler.
2. **Write the API route** if the card needs network:
   `dashboard/app/api/<resource>/route.ts`. GET returns JSON.
3. **Create the component** at `dashboard/components/<name>-card.tsx`.
   - Server Component by default.
   - Use `Card` + `CardHeader` + `CardContent` from shadcn.
   - Handle empty / loading / error / populated states (see
     `standards/dashboard-ui.md`).
4. **Slot it into the right rail** in `dashboard/app/page.tsx`. Order
   from most actionable (top) to most reference (bottom).
5. **Style with tokens, not hex** — see `standards/dashboard-ui.md`.

## Refresh strategy

- Cards backed by SQLite or the filesystem can poll every 5s with
  `revalidate: 5` on the route, or use an SSE subscription if updates
  must be near-real-time.
- Don't subscribe to chokidar from the client; the watcher writes to
  SQLite, the client reads from SQLite.
