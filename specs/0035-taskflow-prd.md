# Spec 0035: TaskFlow PRD (software-engineering team e2e probe)

**Status:** Draft (proposed)
**Owner:** TJ
**Date:** 2026-06-15
**Phase:** 12 (compounding quality wave)
**Kind:** Product requirements for a probe project, not a dashboard feature.

Implementation follows the karpathy-guidelines skill.

## Context

The dashboard can now spawn runs on three runtime CLIs (claude-code, gemini-cli,
antigravity-cli), and a hand-authored software-engineering team of agents exists
(engineering-lead, backend-engineer, frontend-engineer, qa-tester, code-reviewer)
spread across those runtimes. What has not been proven is the whole loop: a real
project, decomposed into issues, worked by those agents in their own worktrees on
their own runtimes, integrated into something that actually runs.

TaskFlow is that probe. It is a deliberately small full-stack task tracker. It is
large enough to give each role real work (an API for the backend engineer, a UI
for the frontend engineer, a test suite for the QA tester, a merge gate for the
reviewer, integration for the lead) and small enough to finish in a handful of
runs. The point is not TaskFlow itself; it is exercising the team and the OS.

## Goals

1. A working task tracker: create, list, complete, and delete tasks through a
   JSON API and a browser UI.
2. Every team role does real work on its assigned runtime, end to end, producing
   committed code in a worktree and a clean run finalize.
3. The assembled app runs and its test suite passes with no external setup.

## Non-goals

- Auth, multi-user, accounts. Single local user.
- A database. Persistence is a JSON file on disk.
- A frontend framework or build step. Plain HTML, CSS, and vanilla JS.
- Deployment, Docker, CI. This is a local probe.

## Tech stack (deliberate, for probe reliability)

To keep the probe dependency-free and instantly runnable inside isolated git
worktrees (where `node_modules` is gitignored and a network install would add
flakiness across three different runtimes), TaskFlow uses the Node standard
library only:

- Server: Node built-in `http` module (no Express). One small router.
- Persistence: a JSON file (`data/tasks.json`), read and written with `fs`.
- Tests: the Node built-in test runner (`node --test`), no vitest.
- Frontend: static `index.html`, `style.css`, `app.js` served by the same Node
  server; the JS talks to the API with `fetch`.

This is a conscious deviation from an Express + vitest stack. It trades a familiar
framework for zero install and a server that any of the three runtimes can run
with `node` alone. Reversal: if the team needs Express, add it in a later issue.

## Data model

A task is:

```
{
  "id": "string (uuid)",
  "title": "string, non-empty, trimmed",
  "done": boolean,
  "createdAt": "ISO-8601 string"
}
```

Tasks persist to `data/tasks.json` as a JSON array. The store module owns all
reads and writes and creates the file (and `data/` dir) on first use.

## API contract (authoritative)

Base URL `http://localhost:3000`. JSON request and response bodies.

| Method | Path           | Body                  | Success            | Errors |
|--------|----------------|-----------------------|--------------------|--------|
| GET    | `/api/tasks`   | none                  | 200 `[Task, ...]`  |        |
| POST   | `/api/tasks`   | `{ "title": string }` | 201 `Task`         | 400 if title missing or empty |
| PATCH  | `/api/tasks/:id` | `{ "done": boolean }` | 200 `Task`       | 400 if `done` not boolean; 404 if id unknown |
| DELETE | `/api/tasks/:id` | none                | 204 no body        | 404 if id unknown |

- New tasks get a generated id (`crypto.randomUUID()`), `done: false`, and an
  ISO `createdAt`.
- Error responses are JSON: `{ "error": "message" }` with the status above.
- Unknown routes return 404 JSON. Non-API GETs serve static files.

## Frontend requirements

A single page served at `/`:

- Lists all tasks, newest first, each showing the title, a done checkbox, and a
  delete button.
- An input plus Add button creates a task (empty or whitespace-only titles are
  rejected client-side and the input refocuses).
- Toggling the checkbox PATCHes `done`; the row reflects completed state.
- Delete removes the task via DELETE and updates the list.
- All actions go through the real API with `fetch`; loading and error states are
  handled so a failed request shows a visible message rather than breaking.
- Accessible markup: labelled controls, keyboard usable.

## Test requirements

`node --test` suite covering the store and the API:

- POST creates a task with the right shape and defaults; rejects empty title (400).
- GET returns all tasks.
- PATCH toggles `done`; rejects non-boolean (400); 404 on unknown id.
- DELETE removes a task (204); 404 on unknown id.
- An API smoke test that boots the server on an ephemeral port, runs a full
  create -> list -> complete -> delete cycle against real HTTP, and asserts each
  response, then closes the server.
- Tests use a temp data file so they never touch real `data/tasks.json`.

## Acceptance criteria

1. `npm test` (mapped to `node --test`) passes with zero failures and no skips.
2. `npm start` serves the app; `GET /api/tasks` returns JSON and `/` serves the UI.
3. A manual create -> complete -> delete cycle works in the browser against the
   live API.
4. No runtime dependencies in `package.json` (stdlib only); `node_modules` absent.
5. No scope creep beyond this spec.

## Work breakdown (seed issues)

Worked in dependency order; the lead merges each green slice to `main` before the
next dependent slice starts so downstream worktrees branch from updated code.

1. Backend API + task store (backend-engineer, claude-code).
2. Test suite + API smoke test (qa-tester, gemini-cli).
3. Frontend UI wired to the API (frontend-engineer, antigravity-cli).
4. Review pass over the assembled app (code-reviewer, claude-code).
5. Integration and wiring: README, `npm start`/`npm test` scripts, final run
   (engineering-lead, claude-code).

## Verification

Run `npm test` (node --test) and `npm start`, hit the API with curl, and load the
page. The probe succeeds when all three runtimes have completed a real run with
committed code and the assembled app runs green.
