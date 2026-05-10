---
name: pr-review-prep
description: Given a GitHub PR URL, fetch the diff, files changed, and CI status via the GitHub MCP, then prepare a review checklist with hot-spots, suggested test cases, and questions for the author. Use when the user asks to "prep PR [url]", "review this PR", "what should I look at in [pr]", or "help me review [owner/repo#num]".
license: MIT
metadata:
  status: authored
  domain: coding
  mode: remote
  mcp-server: github
  external-apis: [none]
  outputs: [vault/wiki/coding/pr-OWNER-REPO-NUM.md]
---

# pr-review-prep

Pre-review preparation, not the review itself. Goal: when the user
opens the PR in the browser, they already know which files matter,
what the risk shape is, and which questions to ask the author.

**Orchestration pattern:** sequential workflow with one iterative
refinement step (build hot-spots → re-read against the diff → revise).
Bias toward concrete questions over generic checklists.

## Instructions

1. **Parse the PR identifier.** Accept any of:
   - URL `https://github.com/<owner>/<repo>/pull/<num>`
   - shorthand `<owner>/<repo>#<num>`
   - just `#<num>` if the user has a default repo set in context
   Extract `owner`, `repo`, `num`. The deterministic parser is at
   `../../../scripts/validators/parse_pr_id.py` — call it via
   `echo "<input>" | python ../../../scripts/validators/parse_pr_id.py`
   (set `DEFAULT_REPO=owner/repo` for the bare-`#num` case).

2. **Fetch in parallel.** Use the GitHub MCP. Before the first call,
   read `../../../references/services/github.md` for tool selection
   (prefer `pull_request_read` over multiple `get_file_contents`),
   the 30/min secondary search-API limit, and how to disambiguate
   the three flavors of 403.
   - `pull_request_read` for the PR body, base/head SHAs, labels,
     reviewers, mergeable state, draft status.
   - `pull_request_read` with the `files` mode (or
     `get_file_contents` per file) for the diff.
   - `list_commits` for the commit list and messages.
   - The PR's combined CI status (via the checks endpoint surfaced by
     the MCP).

3. **Triage the changeset.** Build a one-line summary of each changed
   file: `path | +N -M | one-line role`. Then sort:
   - **Hot files** — files in `app/api/`, `lib/`, security-adjacent
     paths, migration files, anything in `scripts/`, plus any file
     where `+lines + -lines > 100`.
   - **Cool files** — tests, snapshots, docs, lockfiles. Note their
     existence; don't re-derive their content.

4. **Read hot files in full.** Don't trust the diff alone — context
   above and below the hunks matters for review. Note:
   - Public API surface changes.
   - New external calls (HTTP, DB, subprocess).
   - Error paths and how failures propagate.
   - State that survives across requests (caches, singletons).

5. **Generate the checklist.** Three sections:
   - **Hot-spots** — specific lines / functions to read closely, with
     why.
   - **Tests** — what's covered, what's missing, what tests *you*
     would add. Be concrete: "cover the case where the SSE stream
     closes before `done` arrives" beats "test edge cases".
   - **Questions for the author** — concrete, answerable. Avoid
     "have you considered X" without specifying what X looks like.

6. **Optional: refine.** Re-read your checklist against the diff. If
   any item is generic or wouldn't change behavior whether the
   author answered yes or no, drop it. The goal is a checklist that
   makes the review faster, not longer.

7. **Write the prep doc** to
   `vault/wiki/coding/pr-<owner>-<repo>-<num>.md` with frontmatter
   and the structure under Outputs. End with a one-line **Verdict**:
   ready to review / blocked on (specific item).

8. **Report** the doc path back to the user.

## Inputs

| Input | Default | Notes |
|---|---|---|
| `pr` | required | URL, `owner/repo#num`, or `#num`. |
| `default_repo` | none | Used to resolve bare `#num`. |
| `read_full_threshold` | `100` | Sum of +/-lines that promotes a file to "hot". |

## Outputs

- `vault/wiki/coding/pr-<owner>-<repo>-<num>.md` with frontmatter:
  ```yaml
  ---
  domain: coding
  source: pr-review-prep
  created: <today>
  updated: <today>
  pr: https://github.com/<owner>/<repo>/pull/<num>
  base: <sha>
  head: <sha>
  ci: <green|red|pending>
  ---
  ```
  Sections: `## Summary`, `## Files`, `## Hot-spots`, `## Tests`,
  `## Questions for author`, `## Verdict`.

## Example

Prompt: "prep PR tirtheshjani/agentic-os#42"

Excerpt:
```markdown
# PR prep — tirtheshjani/agentic-os#42 "Stream tool events to dashboard"

## Summary
Adds tool-use events to the SSE stream from /api/run. CI: green.

## Files (4 changed, +180 -32)
- dashboard/lib/claude-headless.ts | +120 -18 | new event types, parser
- dashboard/app/api/run/route.ts   |  +12  -2 | wire new events
- dashboard/components/output-stream.tsx | +40 -10 | render tool blocks
- dashboard/components/output-stream.test.tsx | +8 -2 | one new case

## Hot-spots
- `claude-headless.ts:71-104` — new JSON parsing loop. Confirm the
  buffer split is null-byte-safe (current split is on `\n`; one
  upstream change away from breaking on CRLF).
- `route.ts:34-46` — the SSE close path. If `runClaude` throws *after*
  the first chunk, the run row stays `running` forever. Worth a try /
  finally on the controller.

## Tests
- New case covers the happy path.
- Missing: stream that emits `tool` after `done` (race the parent has
  to handle).
- Missing: stream that closes mid-line (partial JSON in the buffer).

## Questions for author
1. The new event type "tool_call" — is the input intentionally
   serialized as a JSON string in the SSE payload, or should it be a
   nested object? The component currently `JSON.parse`s it.
2. Why was `verbose: true` added to the spawn args — is the
   downstream parser depending on `--verbose` output, or is it
   diagnostic?

## Verdict
Ready to review. Two questions block approval.
```

## Troubleshooting

- **PR is in a private repo and the MCP returns 404.** The token
  scope is wrong. Surface the MCP error verbatim and stop.
- **PR is huge (>40 files).** Read the PR body and commits first to
  see if the author has staged the change in commits — if so, do a
  per-commit prep instead of one massive checklist. If not, escalate
  to the user: "this PR is N files; want me to prep just the hot
  files (auto-detected: …) or the whole thing?"
- **Diff is binary or generated.** Skip the file in hot-spots and
  list it in `## Files` with `(binary/generated)`.
- **CI is pending.** Note in frontmatter (`ci: pending`) and surface
  in the verdict — many review questions are different on red CI.
- **The PR was force-pushed since you started.** The `head` SHA
  changed. Re-fetch the diff before writing the doc; otherwise the
  hot-spot line numbers will be off.
