// Shared constants for the design layer (app-shell, screens).
//
// Polling interval for views that re-fetch live data (dashboard, board,
// agents, my-issues). 30s matches the previous per-screen literals and
// keeps load on /api/* routes predictable.
export const POLL_INTERVAL_MS = 30_000;
