# Spec 0012: Create-Project Orchestrator (`/new`)

> **Status:** Shipped June 2026. See ADR-012 for the one-shot-draft
> decision.

## Scope

A `/new` tab turns a one-paragraph prompt into a working project: local
git repo under `workspaceRoot`, GitHub remote (via `gh`), vault
`PROJECT.md`, a drafted agent crew, and kickoff issues in the backlog.
Exactly **one** headless `claude -p` call (the orchestrator draft) plans
everything; the rest of the pipeline is deterministic TypeScript.

Out of scope (revisit behind new ADRs if needed): per-step retry,
concurrent create jobs, rollback, non-GitHub forges, repo templates.

## Pipeline steps (`lib/createProject/`)

| Step | What it does | On failure |
|---|---|---|
| `preflight` | claude connected; gh connected (when a repo is wanted); workspaceRoot/vault writable; warn on empty `git config user.email`. Runs before the draft so a missing login never burns a headless credit. | abort |
| `draft` | One `claude -p <prompt> --output-format json` (90s timeout). Reply is Zod-validated (`OrchestratorDraftSchema`) and clamped: unknown skills/tools dropped, team capped at 4, seed issues at 5, unknown runtimes replaced, slugs slugified. Never retried (Agent SDK credit pool). | abort with raw excerpt |
| `resolve` | Project slug suffixed `-2`, `-3`... until free in both `vault/projects/` and `workspaceRoot/`. Existing agent slugs are **reused**, not duplicated. | abort |
| `scaffold` | `mkdir`, seed `README.md`/`.gitignore`/`CLAUDE.md`, `git init -b main` + `add` + `commit`. | abort |
| `github` | `gh repo create <slug> --private\|--public --source . --remote origin --push -d <desc>` in the target dir. Skipped for local-only. | **warning**, continue local-only with a copy-pasteable recovery command |
| `register` | `createProjectFromExistingFolder` writes `vault/projects/<slug>/PROJECT.md` (repo: auto-read from the origin remote); publishes `project.changed`. | abort |
| `agents` | `createAgent` per non-reused member (individual `AgentValidationError` → warning + skip); `updateProjectCrew`. | per-member warning |
| `issues` | `createIssue(status: "backlog")` per seed issue. Backlog is safe: the auto-router only acts on `queued` and only with autonomy on. Skipped when the toggle is off. | abort |

No rollback anywhere: completed artifacts stay, and the result panel
enumerates exactly what exists.

## Draft contract

Reply must be a single JSON object:

```json
{
  "project": { "name": "...", "slug": "kebab", "description": "...", "capabilities": ["..."] },
  "team": [{ "name": "kebab", "slug": "kebab", "description": "routing keywords",
             "skills": ["from listSkills()"], "allowedTools": ["Read", "..."],
             "systemPrompt": "100-250 words", "runtime": "claude-code" }],
  "seedIssues": [{ "title": "imperative", "body": "with acceptance criteria" }]
}
```

Parsing reuses the agents/draft conventions (`lib/llm/extractJson.ts`):
`{result}` envelope unwrap, fence stripping, then Zod.

## Jobs, events, API

- Jobs live in-memory on `globalThis` (`Symbol.for("agentic-os.createProjectJobs")`,
  liveRuns precedent). Single-flight: one running job at a time. Lost on
  server restart by design; the UI explains and points at what exists.
- New `StreamEvent` kinds: `project.create.progress`
  `{jobId, step, status, detail?, error?}` and `project.create.done`
  `{jobId, status}` over the existing SSE bus.
- `POST /api/projects/create` `{prompt, visibility: private|public|local-only,
  runtimeDefault, fileIssues}` → 202 `{jobId, steps}`, 409 when busy,
  400 on validation/unknown runtime.
- `GET /api/projects/create/[jobId]` → `{job}` or 404 (restart/unknown).

## UI

`/new` (nav: "New Project"): prompt textarea, visibility select, runtime
select (from `/api/runtimes`), kickoff-issues toggle, `workspaceRoot`
readout (change in Settings). Submit navigates to `/new?job=<id>` so
refresh survives; `useStream` drives the live `StepChecklist`;
`SuccessPanel` links project/repo/agents/issues and lists warnings, or on
failure lists completed steps + manual cleanup notes (`gh repo delete`
needs the `delete_repo` scope).

## Cost

One headless claude call per create (same monthly Agent SDK credit pool
as agent drafting, ADR policy in `app/api/agents/draft`). The pipeline
never loops or retries the call.
