# Troubleshooting

## "EADDRINUSE: address already in use :::3000"

Something already holds port 3000 — usually the launcher-started server
(the Start Menu shortcut spawns a minimized background instance that
keeps running after you close the app window).

Since June 2026 `server.ts` handles this itself: if the squatter is an
Agentic OS instance you get a friendly "already running" message and a
clean exit; if it is a foreign process you get told to free the port or
set `PORT`. If you see the raw EADDRINUSE crash you are on an older
build.

Fixes:

```powershell
bin/launch-dashboard.ps1 -Stop     # kill whatever listens on :3000
# or run a second instance side by side:
set PORT=3001&& npm run dev
```

`tsx watch` restarts can also race the old process's port release; the
server retries for ~1.5s before giving up, so transient flashes are
normal.

## `/new` says "This job is no longer tracked"

Create jobs live in memory. If the dev server restarts mid-create (e.g.
`tsx watch` picked up a file change), the job record is gone but the
artifacts are not. Check, in order: the target folder under
`workspaceRoot`, `vault/projects/<slug>/PROJECT.md`, `/agents`, and
`/issues`. Re-running the same prompt is safe — colliding slugs get a
`-2` suffix, existing agents are reused.

## `gh repo create` failed but the project finished

That is by design: the github step degrades to a warning and the project
continues local-only. The warning includes the exact recovery command,
roughly:

```bash
cd <workspaceRoot>/<slug>
gh repo create <slug> --private --source . --remote origin --push
```

Common causes: repo name already exists on the account, expired gh
token (`gh auth status`), network.

## Deleting a GitHub repo created by `/new`

`gh repo delete <slug>` needs the `delete_repo` scope:

```bash
gh auth refresh -h github.com -s delete_repo
gh repo delete <owner>/<slug> --yes
```

Or delete it on github.com → repo Settings. Locally also remove the
folder under `workspaceRoot`, `vault/projects/<slug>/`, any
`agents/<slug>.md` files you don't want, and the issues from `/issues`.

## Agent drafting / orchestrator draft fails

Both call headless `claude -p` (one call, never retried — it draws from
the monthly Agent SDK credit pool). Check `claude --version` works in a
fresh terminal and that you are logged in (`claude` interactive). A 502
with a raw excerpt usually means the model replied with prose instead of
JSON; just retry the action.

## Terminal shows garbage / xterm fails to load

xterm and sigma must be imported dynamically inside `useEffect` — module
scope breaks SSR. If you see this after editing dashboard code, check
the imports. On Windows, ConPTY needs Enter sent as a separate delayed
write after a prompt body (already handled in the runtimes).

## Scheduler never fires

Three switches must all be on: `/settings` → Autonomy enabled,
schedulerEnabled, and the automation spec under `automations/remote/`
needs a `project:` key so the issue can be filed. The tick is 60s.

## Vault graph or search is stale

The index full-rebuilds on boot and on a chokidar debounce. Touch any
vault file or restart the server; check the server log for
`[indexer]` lines.
