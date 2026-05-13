---
name: issue-triage
description: Given a GitHub repo, pull open issues, classify each by the rubric in references/triage-rubric.md, surface buckets (Blocker, Reply-now, Needs-info, Watch, Stale-candidate, Wontfix-candidate), draft initial response comments in the report, and propose labels. Never auto-comments, never auto-labels, never auto-closes. Use when the user asks to "triage issues in [repo]", "issue cleanup", "label these issues", "what issues need attention".
license: MIT
metadata:
  status: authored
  domain: coding
  mode: remote
  mcp-server: github
  external-apis: [none]
  outputs: [vault/wiki/coding/issues-<repo>-YYYY-MM-DD.md]
---

# issue-triage

Orchestration pattern: **multi-MCP coordination + domain-specific
intelligence**. The intelligence is the rubric — a fixed, named set of
buckets and a drafting policy. The skill **never auto-comments, never
auto-labels, never auto-closes**. It surfaces buckets and proposes
actions so the maintainer sweeps in one pass.

## References

- `../../../references/services/github.md` — rate limits (anonymous
  search: 10/min, authed REST: 5,000/hr), `search_issues` vs. listing,
  403 disambiguation, PR-vs-issue namespace.
- `references/triage-rubric.md` (skill-local) — bucket definitions,
  duplicate-detection rules, drafting rules, escalation.

## Instructions

1. **Parse the repo reference.** Accept `owner/repo`, a full GitHub URL,
   or — if `GH_OWNER` + `GH_REPO` env vars are set — a bare repo name.
   If ambiguous, ask the user; do not guess.

2. **Confirm scope.** If `owner/repo` is outside the GitHub MCP
   allowlist, read tools will 403 with "Resource not accessible by
   integration". Surface that and stop — do not retry. Per
   `references/services/github.md` 403 disambiguation, this means the
   request is correctly being denied.

3. **Pull open issues.** Use `list_issues` (preferred) or
   `search_issues is:open repo:<owner>/<repo>`. Apply the input filters:
   - `state` filter (default `open`)
   - `label` filter (default none — pull all)
   - sort by `updated` descending so freshest first
   Cap at 200 issues per run. If the repo has more, surface a note in
   the report and ask the user to narrow with a label.

4. **Skip PRs.** PR numbers share the issue namespace; `list_issues`
   returns both. Filter out anything with a `pull_request` field — those
   belong in `pr-review-prep`.

5. **Classify each issue** by the rubric in
   `references/triage-rubric.md`. Apply rows top-to-bottom; first match
   wins. Each issue lands in exactly one bucket. Use the issue title,
   body snippet, labels, last comment author, and last activity
   timestamp — do **not** fetch full comment threads unless drafting
   (step 7).

6. **Detect duplicates.** Within the open set, flag pairs that meet the
   duplicate criteria in the rubric. Mark the newer of the pair as
   `Wontfix-candidate` with a "possible duplicate of #N" note. When the
   match is fuzzy, mark **both** as `Watch` and surface the pair in the
   report — humans do the final dedup.

7. **Draft proposed comments** for Reply-now, Needs-info,
   Stale-candidate, and Wontfix-candidate buckets:
   - Read the issue body and last 5 comments via `get_issue_comments`
     for that issue only.
   - Compose a short draft per the drafting rules in the rubric.
   - The draft lives **in the report**. Do not call any comment-write
     tool — write tools 403 here by design.

8. **Compose the report** at
   `vault/wiki/coding/issues-<repo>-YYYY-MM-DD.md` with this exact
   structure:

   ```md
   ---
   domain: coding
   source: issue-triage
   created: YYYY-MM-DD
   updated: YYYY-MM-DD
   tags: [issue-triage, <repo>]
   ---

   # <repo> issue triage YYYY-MM-DD

   Total open: <N>. Triage covers <M> (skipped <K> PRs).

   ## Blocker
   ## Reply-now
   ## Needs-info
   ## Watch
   ## Stale-candidate
   ## Wontfix-candidate
   ## Escalations
   ## Proposed label changes
   ```

   Every issue entry:

   ```md
   - #<num> · <title> · last activity <YYYY-MM-DD> · current labels: [...]
     - Proposed labels: [...]
     - Possible duplicate of: #<n>   (when applicable)
     - Draft comment:
       > <draft text, one or two short paragraphs>
   ```

   Every bucket header must appear even if empty (write `_none_`
   underneath). Completeness beats brevity — the maintainer scans for
   gaps.

9. **Surface in response:** counts per bucket, count of drafts written,
   the escalation list (security issues, VIP authors), and the report
   path. Do not paste draft bodies into the response — they live in the
   report.

## Inputs

| Input | Default | Notes |
|---|---|---|
| `repo` (required) | — | `owner/repo`, URL, or bare name with env vars |
| `state` | `open` | `open` \| `closed` \| `all`. Closed-set triage is rare. |
| `labels` | none | Comma-separated label filter passed to `list_issues` |
| `stale_days` | `60` | Age threshold for `Stale-candidate` (rubric default) |
| `max_issues` | `200` | Hard cap per run; surface a note if exceeded |

## Outputs

- `vault/wiki/coding/issues-<repo>-YYYY-MM-DD.md` — the triage report.

No issue is commented on, labelled, or closed. The report is the only
artifact.

## Examples

User: "triage issues in tirtheshjani/agentic-os"

→ Skill calls `list_issues` with `state=open`. 47 open issues, 3 of
which are PRs (skipped). Classifies the remaining 44: 2 Blocker, 5
Reply-now, 8 Needs-info, 12 Watch, 14 Stale-candidate, 3
Wontfix-candidate (1 flagged as possible duplicate of #12). One issue
has the word "vulnerability" in its title → Escalations + **no draft
comment**. Writes 13 drafts into the report (Reply-now + Needs-info +
Stale-candidate + Wontfix-candidate, minus the escalated one). Writes
the report.

Response:

> Triaged 44 open issues in agentic-os (skipped 3 PRs). Blocker: 2.
> Reply-now: 5. Needs-info: 8. Watch: 12. Stale-candidate: 14.
> Wontfix-candidate: 3. Escalations: 1 — #38 (possible security
> issue, not drafted). 13 reply drafts written into the report. Report:
> `vault/wiki/coding/issues-agentic-os-2026-05-13.md`.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| 403 "Resource not accessible by integration" | Repo outside MCP allowlist | Stop; do not retry; report config |
| 403 "secondary rate limit" | Burst from `get_issue_comments` loop | Wait `Retry-After`; reduce drafts batch or run with a tighter label filter |
| Every issue lands in Watch | Rubric matched the catch-all first | Rubric is applied top-to-bottom; check that Blocker/Needs-info criteria are evaluated before Watch |
| PRs leaked into the report | Forgot to filter on `pull_request` field | `list_issues` returns both; filter after fetch |
| "possible duplicate" called on unrelated issues | Title similarity threshold too loose | Tighten per rubric: require both title-similarity and body-overlap before calling |
| Report exceeds 200 issues with `_none_` placeholders | `max_issues` cap hit and surfaced as truncation | Re-run with a label filter to narrow scope |
| Draft posted as a real comment | Cannot happen via this skill — write tools 403 by design | If it did, the rubric was bypassed; report the bug |
