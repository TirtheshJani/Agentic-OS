# Create a project from a prompt (`/new`)

The New Project tab turns one paragraph into: a local git repo, a GitHub
remote, a vault project, an agent crew, and kickoff issues. Spec 0012
documents the internals; this is the operator guide.

## Before the first use

1. `/connections` shows **Claude Code** and **GitHub** connected
   (`claude` logged in, `gh auth login` done). Local-only mode needs only
   Claude.
2. `/settings` → **workspaceRoot** points at the folder where new repos
   should land (e.g. `C:\Users\TJ\Documents\GitHub`). The form shows the
   current value before you create anything.

## Using it

1. Describe the project in 1-3 sentences. Concrete beats vague: the
   description seeds the repo README, the agent team, and the kickoff
   tasks. Naming wish: say `Name the project exactly "foo-bar"` and the
   slug follows.
2. Pick repo visibility (**private** default, public, or local-only),
   the default runtime, and whether to file kickoff issues (on by
   default; they land in **Backlog**, so nothing runs until you queue
   them).
3. Create. The checklist streams live; the draft step costs **one
   headless Claude call** (Agent SDK credit pool) — there is no retry
   button by design, just run it again.
4. Success panel links the project board, the GitHub repo, `/agents`,
   and `/issues`.

## Semantics worth knowing

- **No rollback.** A failure at step N leaves steps 1..N-1 in place and
  the panel lists exactly what exists. Re-running is safe: project slugs
  suffix (`-2`), existing agents are reused.
- **gh failure ≠ job failure.** The github step degrades to a warning
  and the project continues local-only; the warning carries the exact
  recovery command.
- **Crew reuse.** If the draft proposes an agent slug that already
  exists (`agents/<slug>.md`), the existing agent joins the crew
  unchanged.
- **Jobs are in-memory.** If the dev server restarts mid-create, the
  page says the job is untracked; the artifacts are still on disk (see
  `docs/troubleshooting.md`).

## Cleanup recipe (undoing a test project)

```bash
gh auth refresh -h github.com -s delete_repo   # once
gh repo delete <owner>/<slug> --yes
```

Then delete `workspaceRoot/<slug>`, `vault/projects/<slug>/`, the
`agents/*.md` files you don't want (or archive from `/agents`), and the
issues from `/issues`.
