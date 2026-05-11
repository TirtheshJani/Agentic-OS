# GitHub

The GitHub MCP server exposes REST + search + PR/issue tooling. This
ref is the central source of rate limits, auth gotchas, and tool
selection guidance for every skill that touches GitHub.

## Auth scopes

The MCP server is configured in this repo with **read** access to a
single repository (`tirtheshjani/agentic-os`). Skills that need to
read other repos (e.g. `morning-trend-scan` against the public-search
surface) rely on the **unauthenticated** search endpoints exposed via
the same server.

| Capability | Scope required |
|---|---|
| Read PR + diff in scoped repo | already configured |
| Search across public repos | none (anonymous) |
| Write a comment, create a PR | not authorized here — refuse |
| Read a private repo outside the allowlist | not authorized — refuse |

A 403 on a write tool means **the request is correctly being denied**,
not that auth needs fixing. Don't retry.

## Rate limits

| Endpoint family | Anonymous | Authenticated |
|---|---|---|
| REST (`get_*`, `list_*`) | 60 req/hr per IP | 5,000 req/hr |
| Search (`search_repositories`, `search_code`, `search_issues`) | 10 req/min per IP | 30 req/min |
| GraphQL (not exposed here) | n/a | 5,000 points/hr |

Headers to watch:
- `X-RateLimit-Remaining` — drop below 10% means slow down.
- `X-RateLimit-Reset` — Unix timestamp when the bucket resets.
- `Retry-After` (on secondary rate limit) — seconds to wait.

A skill that hits secondary rate limit (HTTP 403 with the message
"secondary rate limit") should back off `Retry-After` seconds rather
than retry immediately.

## Tool selection

Prefer specific tools over search:

- Reading a PR by number → `pull_request_read` (not `search_pull_requests`).
- Listing commits on a branch → `list_commits`.
- Finding a file's contents → `get_file_contents`.

Use search only when the lookup is keyword-driven:

- `search_repositories language:python created:>2026-04-01 sort:stars` —
  approximates GitHub trending for a recent window.
- `search_issues is:open label:bug repo:foo/bar` — when you don't have
  an issue number.

## 403 disambiguation

Three different meanings, three different fixes:

| Message contains | Meaning | Action |
|---|---|---|
| "Bad credentials" | Token rejected or absent | Stop; report config issue |
| "secondary rate limit" | Burst limit tripped | Wait `Retry-After`, retry once |
| "Resource not accessible by integration" | Token lacks the scope | Stop; do not retry |

## Common gotchas

- **PR numbers vs. issue numbers share a namespace.** A reference like
  `#1234` could be either; use `pull_request_read` first and fall back
  to issue lookup on 404.
- **`search_repositories` does not surface trending directly** — there
  is no public trending API. Approximate via `created:>YYYY-MM-DD
  sort:stars` with a 1–7 day window.
- **`get_file_contents` returns base64-encoded `content`** for files
  larger than a small threshold. Always decode before string-matching.
- **Diff vs. unified PR view.** `pull_request_read` returns the unified
  PR. To get the diff itself, the MCP server exposes it inline in the
  PR payload's `diff_url` field; fetch separately if you need it.
- **PR review state** vs. comments — leaving a comment on a line is
  `add_comment_to_pending_review`; you must `pull_request_review_write`
  to actually submit the review. Skills used for review prep should
  draft the review locally and not auto-submit.
