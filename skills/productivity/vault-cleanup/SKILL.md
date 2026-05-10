---
name: vault-cleanup
description: List vault/raw/ files older than a configurable threshold (default 30 days), classify each as archive / promote / keep / delete, present the plan, and apply on confirmation. Use when the user asks to "clean up the vault", "archive old notes", "vault hygiene", or "what's stale in vault".
license: MIT
metadata:
  status: authored
  domain: productivity
  mode: local
  mcp-server: none
  external-apis: [none]
  outputs:
    - vault/archive/ (moves)
    - vault/wiki/<domain>/ (promotions)
    - vault/raw/daily/YYYY-MM-DD-vault-cleanup.md (report)
---

# vault-cleanup

Periodic hygiene pass over `vault/raw/`. The vault grows quickly when
daily notes and skill outputs land there; this skill keeps it small
enough to be useful as a search surface.

**Orchestration pattern:** iterative refinement — propose a plan, get
explicit confirmation, then apply. The first pass is always a dry run.

## Instructions

1. **Build the candidate list.** Walk `vault/raw/` and collect every
   file whose modification time is older than `threshold_days`
   (default 30). Use git's last-touch time, not filesystem mtime, so
   that a `git pull` doesn't reset the clock:
   ```bash
   git -C vault log -1 --format=%ct -- <path>
   ```

2. **Classify each candidate.** For each file, decide one of four
   actions and record the reason:

   - **promote** — the topic appears in ≥2 daily notes or has been
     referenced from `vault/wiki/`. Move to
     `vault/wiki/<domain>/<slug>.md`. Prefer existing wiki pages
     before creating new ones; merge into them when there's a clear
     home.
   - **archive** — single-use or one-off note that's no longer
     active. Move to `vault/archive/<original-relative-path>`,
     preserving structure.
   - **delete** — empty file, accidental dupe, or auto-generated
     scratch with no content worth keeping (e.g. zero-byte or
     boilerplate-only).
   - **keep** — explicitly recent activity, currently linked from an
     active project, or contains a TODO that hasn't been resolved.

   Be conservative on **delete** and **promote**. When in doubt,
   archive — it's reversible and cheap.

3. **Present the plan.** Print a markdown table grouped by action,
   with file path, age in days, and reason. Wait for the user's
   confirmation before doing anything.

   ```
   | action  | path                                  | age | reason            |
   | ------- | ------------------------------------- | --- | ----------------- |
   | promote | vault/raw/2026-04-02-rag-eval.md      |  38 | ≥2 daily mentions |
   | archive | vault/raw/2026-03-15-spike-foo.md     |  56 | one-off spike     |
   | delete  | vault/raw/2026-03-20-untitled.md      |  51 | empty             |
   ```

4. **Apply on confirmation.** Use `git mv` (not `mv`) so history is
   preserved. For deletes, use `git rm`. For promotions, if the target
   wiki file already exists, append the relevant content under a
   `## From <YYYY-MM-DD>` heading rather than overwriting.

5. **Write a report** to
   `vault/raw/daily/<today>-vault-cleanup.md` summarizing what moved,
   what was promoted (with new wiki path), and what was deleted. Keep
   it short — the report itself is also a `raw/` note and will be
   subject to the next cleanup.

## Inputs

| Input | Default | Notes |
|---|---|---|
| `threshold_days` | `30` | Older than this is a candidate. |
| `domain_filter` | none | Restrict to one domain (e.g. `research/physics-ml`). |
| `dry_run` | `true` | When `true`, plan only; never modify files. |

## Outputs

- `vault/wiki/<domain>/<slug>.md` for promotions.
- `vault/archive/<original-relative-path>` for archives.
- `vault/raw/daily/<today>-vault-cleanup.md` — the report (always).

## Example

Prompt: "clean up the vault, dry run first"

```
Candidates older than 30 days: 14 files

| action  | path                                       | age | reason                      |
| ------- | ------------------------------------------ | --- | --------------------------- |
| promote | vault/raw/2026-04-02-rag-eval-notes.md     |  38 | mentioned in 3 daily notes  |
| promote | vault/raw/2026-03-28-llm-pricing.md        |  43 | linked from wiki/business/  |
| archive | vault/raw/2026-03-15-spike-canary.md       |  56 | spike, no follow-up         |
| archive | vault/raw/2026-03-10-misc-thoughts.md      |  61 | scratch                     |
| keep    | vault/raw/2026-04-01-onboarding-template.md| 39 | linked from active project  |
…
```

User: "looks good, apply"

Output: 9 archives, 3 promotions, 0 deletes; report at
`vault/raw/daily/2026-05-10-vault-cleanup.md`.

## Troubleshooting

- **`git mv` fails with "not under version control".** The file is
  untracked. Add it first (`git add <path>`) or fall back to plain
  `mv` and `git add` the destination.
- **Promotion target conflicts.** A wiki file with the same slug
  already exists. Append under `## From <date>` rather than
  overwriting — the user can clean up the merge later.
- **User says "ignore X".** Add the path to a `vault/.cleanupignore`
  file (gitignore-style) so it's stably skipped on future runs.
- **Mass-archive concern.** If more than 50% of candidates would be
  archived, surface that as a flag — it usually means
  `threshold_days` is too aggressive for this user's habits.
