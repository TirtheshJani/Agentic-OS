# GitHub MCP — service reference

Used by skills that read PRs, issues, repos, or commits. The MCP
server we use is registered as `github` (tools surfaced as
`mcp__github__*`).

## Auth

OAuth or PAT, depending on how the user registered the MCP. Required
scopes for the operations skills in this repo perform:

| Operation | Scope |
|---|---|
| Read public repos | `public_repo` |
| Read private repos | `repo` |
| Read PR file contents | `repo` (private) or none (public) |
| List authenticated user's PRs (`author:@me`) | `read:user` |
| Read CI status | `repo:status` (or `repo`) |

If a call returns **403** with a "Resource not accessible" message,
it's almost always a missing scope, not a bad token.

## Rate limits

- **Authenticated REST:** 5,000 requests/hour, per user.
- **Search API:** 30 requests/minute (this is the secondary limit
  most skills hit). Surfaces as **403** with
  `X-RateLimit-Remaining: 0` *and* the body mentions "secondary rate
  limit". Different from primary 403 (scope error) — distinguish
  before retrying.
- **GraphQL:** 5,000 points/hour (each query has a computed cost).

Headers on every response:
- `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
  (epoch seconds).

## Tool selection

The GitHub MCP exposes ~50 tools. Prefer:

- **`pull_request_read`** for everything about one PR (metadata, files,
  comments, reviews). One call beats five.
- **`search_issues`** with `is:pr` qualifier instead of
  `list_pull_requests` when you want filtered results — `list_*`
  paginates by default and the search query is cheaper.
- **`get_file_contents`** with a `ref` (SHA or branch) for any file
  read. Without `ref`, you get the default branch which may not match
  what the PR is changing.
- **`search_repositories`** to approximate "trending": no real
  trending API exists. Use `created:>YYYY-MM-DD language:<lang>`
  with `sort:stars order:desc` for a recency-weighted top-N.

Avoid:
- `get_commit` in a tight loop — use `list_commits` with a path
  filter, or pull the diff once via `pull_request_read`.

## Common errors

| Status | Meaning | Action |
|---|---|---|
| 401 | Token invalid or revoked | Surface to user; don't retry. |
| 403 + `X-RateLimit-Remaining: 0` | Hit primary rate limit | Wait until `X-RateLimit-Reset`; usually <1h. |
| 403 + "secondary rate limit" in body | Search-API burst limit | Backoff 60s, retry once. |
| 403 + "Resource not accessible" | Missing scope | Surface to user with the scope name. |
| 404 | Repo private + token has wrong scope, or repo doesn't exist | Distinguish: a `HEAD` on the org succeeds → repo is private. |
| 422 | Validation failed (e.g. malformed query) | Echo the GitHub error message verbatim. |
| 500/502/503 | GitHub side | Retry with exponential backoff up to 3 times. |

## Pagination

Every list endpoint paginates. Defaults are usually 30 items, max 100.
The MCP wrappers usually expose `perPage` and `page` parameters. For
operations that might span >100 items (a PR with many files, a
busy issue list), check whether the MCP tool returns a "more results
exist" indicator and follow it; otherwise the result is silently
truncated.

## Gotchas

- **`@me` works in search queries** without knowing the username, e.g.
  `is:pr author:@me`. Skills should prefer this over hard-coded
  usernames.
- **Force-pushes change the head SHA** of a PR. If your skill cached
  the SHA at the start of a run, re-fetch before writing output that
  references line numbers.
- **Default branch is not always `main`.** Use the repo's
  `default_branch` field from `pull_request_read` or
  `search_repositories`, don't assume.
- **Issue comments and PR review comments are different APIs.** A
  "comment on a PR" can be an *issue comment* (top-level discussion)
  or a *review comment* (attached to a line). The MCP exposes both;
  pick the right one for the operation.
- **Combined CI status (the "checks API")** has multiple shapes
  depending on whether the repo uses Checks (modern) or Statuses
  (legacy). Most repos use Checks; the MCP surfaces both.
- **Search results cap at 1,000.** Beyond 1k, GitHub returns the same
  results and silently drops the rest. If a query plausibly matches
  more, narrow the search.

## See also

- Authoritative docs: <https://docs.github.com/en/rest>
- Rate-limit details:
  <https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api>
