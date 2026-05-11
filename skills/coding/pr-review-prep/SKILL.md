---
name: pr-review-prep
description: Given a GitHub PR reference (URL, owner/repo#N, or bare #N with env vars), fetch diff + hot files in full + CI status, then prepare a review checklist with specific hot-spots and questions. Refines the draft once to drop generic items. Use when the user asks to "prep PR", "review this PR", "what should I look at in this PR".
license: MIT
metadata:
  status: authored
  domain: coding
  mode: remote
  mcp-server: github
  external-apis: [none]
  outputs: [vault/wiki/coding/pr-<repo>-<num>.md]
---

# pr-review-prep

Orchestration pattern: **sequential + iterative refinement**. Sequential
fetch → draft → refine. The refinement pass drops generic checklist
items ("test edge cases") and keeps only specific ones ("cover the case
where the SSE stream closes before `done`").

## References

- `references/services/github.md` — read tool selection, 403
  disambiguation, PR vs. issue namespace.
- `scripts/validators/parse_pr_id.py` — normalize the PR reference
  before any GitHub call.

## Instructions

1. **Parse the PR reference.**
   ```bash
   python3 scripts/validators/parse_pr_id.py "<ref>"
   ```
   Exit 0 → use the JSON `{owner, repo, number}`. Exit 1 → ask the
   user to clarify; do not guess. Exit 2 → script bug, surface and
   stop.
2. **Confirm scope.** If `owner/repo` is outside the MCP server's
   allowlist (`tirtheshjani/agentic-os`), the read tools will 403 with
   "Resource not accessible by integration". Surface that and stop —
   do not retry.
3. **Fetch in this order:**
   - `pull_request_read` for title, body, base/head, labels, mergeable
     state, CI conclusion.
   - For each file in the PR (capped at top 20 by changed lines):
     `get_file_contents` on the **head ref**. Read hot files **in
     full**, not just the diff — diff-only review misses surrounding
     context that determines whether a change is safe.
   - `list_commits` on the PR to see the commit-by-commit shape.
4. **Draft the review note** at
   `vault/wiki/coding/pr-<repo>-<number>.md`:
   ```md
   ---
   domain: coding
   source: pr-review-prep
   created: YYYY-MM-DD
   updated: YYYY-MM-DD
   tags: [pr, <repo>]
   ---

   # <repo>#<number> · <title>

   ## Context
   ## CI status
   ## Hot files
   ## Specific questions
   ## Checklist (specific only)
   ```
   - **Context:** PR description summary + base/head + author.
   - **CI status:** conclusion per check, with link to failing logs.
   - **Hot files:** for each, 2–4 lines on what changed and why it
     matters. Reference specific line ranges, not "the whole file".
   - **Specific questions:** things only this PR could prompt
     (invariants, error handling at named boundaries, migration
     order).
5. **Refine.** Re-read the draft. For every checklist item, ask "would
   a reviewer earn anything by checking this?" Drop:
   - Generic items ("test edge cases", "check for null").
   - Items already covered by linters/CI.
   - Items reading the diff would obviously surface.
   Keep:
   - Specific assertions about behavior under named conditions.
   - Migration/rollback steps if the PR touches data shape.
   - Cross-file consistency checks the diff doesn't surface.
6. **Surface the note path** in the response. Do not auto-submit any
   review (`pull_request_review_write` is reserved for the user).

## Inputs

- `ref` (required, string). PR URL, `owner/repo#N`, or `#N` with
  `GH_OWNER` + `GH_REPO` env vars set.
- `hot_file_limit` (optional, int). Default: 20.

## Outputs

- `vault/wiki/coding/pr-<repo>-<number>.md`

## Examples

User: "prep PR https://github.com/TirtheshJani/Agentic-OS/pull/7"

→ Validator returns `{owner:"TirtheshJani", repo:"Agentic-OS",
number:7}`. Fetch passes. Draft has 12 checklist items; refinement
drops 7 generic ones and adds 3 specific ones based on what the diff
shows. Writes
`vault/wiki/coding/pr-Agentic-OS-7.md`.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Validator exit 1 on a bare `#7` | `GH_OWNER` / `GH_REPO` not set | Ask user to set them or pass full ref |
| 403 "Resource not accessible" | Repo outside MCP allowlist | Stop; do not retry; report config |
| 404 on `pull_request_read` | Number is an issue, not a PR | Per `references/services/github.md` PR and issue numbers share a namespace; surface |
| Hot-files section feels generic | Diff read without surrounding context | Re-fetch full files with `get_file_contents` on head |
| Checklist still generic after refine | Refinement pass too lenient | Tighten: drop any item that doesn't reference a specific symbol, line range, or invariant |
