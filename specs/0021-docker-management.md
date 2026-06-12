# Spec 0021 — Docker management

**Status:** Shipped
**Owner:** TJ
**Date:** 2026-06-11
**Decision record:** ADR-017

Implementation follows the karpathy-guidelines skill.

## Context

TJ runs local service stacks (LightRAG among them) via docker compose and wants visibility and lifecycle control from the dashboard without switching to a terminal.

## Decisions (ADR-017)

1. **CLI subprocess only, no socket library.** Docker Desktop on Windows exposes a named pipe whose path varies by engine mode; the `docker` binary abstracts the transport, `--format json` gives machine output, and spawnSync matches every other exec in the repo (worktrees, connections). No dockerode dependency.
2. **Read everything, mutate only allowlisted compose projects.** `settings.docker.allowlist` lists compose project names whose start/stop/restart is permitted; everything else renders disabled with a tooltip. Project names are regex-validated before reaching argv. The whole feature is off by default (`settings.docker.enabled: false`); routes return 403 while disabled.
3. **Logs are a `<pre>` tail, not xterm.** `docker logs --tail` is static text; ANSI stripped, 3s poll while the drawer is open. No PTY, no WebSocket.
4. **JSON output is parsed both ways.** `docker ps --format json` emits NDJSON on modern CLIs; the wrapper parses arrays or line-wise and falls back to `--format "{{json .}}"` when plain json is rejected.

## Files

`lib/docker.ts` (wrapper with an injected-exec test seam), routes `GET /api/docker`, `POST /api/docker/stacks/[name]/[action]`, `GET /api/docker/containers/[id]/logs`, view `app/docker/page.tsx`, `checkDocker()` in `lib/connections.ts` (unavailable / not-configured "Start Docker Desktop" / connected — the binary-present vs daemon-reachable split verified on this machine).

## UI

`/docker` — availability EmptyStates, stack cards with allowlist-gated action buttons, container table with state badges, logs drawer. Nav entry is always visible; the page itself explains when the feature is disabled (deviation from the plan's hidden-nav idea: NavSidebar is a client component without settings access, and a visible-but-explained page is simpler and more discoverable).

## Settings

`docker: { enabled: false, allowlist: [] }` (PatchSchema extended; settings page section pending, same note as evals).

## Tests

`tests/docker.test.ts` — exec-fake fixtures: binary/daemon split (real daemon-down stderr), compose ls array parse, ps NDJSON + label extraction, `{{json .}}` fallback, allowlist + name-validation gating, ANSI-stripped logs, id validation.

## Limitations

- 30s spawnSync timeout can be tight for cold `compose restart` on big stacks; surfaced as an error, retry manually.
- No per-container start/stop (stack-level only) until a need appears.
