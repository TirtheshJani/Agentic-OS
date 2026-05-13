# Notion

The Notion MCP server exposes search, fetch, create, and update
tooling against the connected workspace. This ref is the central
source of rate limits, auth gotchas, and tool selection for every
skill that touches Notion (currently `weekly-rollup`,
`collective-update`, and `engagement-report`).

## Auth scopes

OAuth integration scoped to the connected workspace. The integration
has access only to pages and databases explicitly **shared with it**
inside the workspace. A page that exists in the workspace but is not
shared with the integration is invisible: `notion-search` will not
return it, and `notion-fetch` on its ID returns 404.

| Capability | Access |
|---|---|
| Search workspace pages and databases shared with the integration | configured |
| Fetch a page or block by ID | configured |
| Create new pages and databases | configured |
| Update existing pages | configured |
| Read pages not shared with the integration | not authorized — invisible |
| Cross-workspace access | not supported |

A 404 on a `notion-fetch` of a page ID that "should exist" almost
always means the page isn't shared with the integration, not that
the ID is wrong.

## Rate limits

Notion's documented limit is an **average of 3 requests per second
per integration**. The API is burst-tolerant for short spikes but
sustained traffic above the average is throttled with HTTP 429.

| Concern | Number |
|---|---|
| Sustained average | 3 req/s per integration |
| Short burst tolerance | ~10 req/s for a few seconds |
| 429 recovery | back off ~1 second, then resume |

Every request must include a `Notion-Version` header (the MCP server
sets this for you). When Notion ships a breaking API change the
version pin keeps existing skills working.

## Tool selection

Decision tree, cheapest first:

- **Have a page or block ID** → `notion-fetch`. Always preferred over
  searching by title.
- **Looking up a page by name** → `notion-search` with the title as
  the query. Note that newly-created pages may take a few seconds to
  appear in search; fetch-by-ID is immediate.
- **Querying database rows** → `notion-search` is fine for a single
  database whose ID you know; for repeated queries against the same
  database, cache the database ID and use `notion-fetch` on it.
- **Creating content** → `notion-create-pages` for single or
  batch creation. `notion-duplicate-page` is faster than re-creating
  a templated page from scratch.
- **Updating** → `notion-update-page` for property and block edits.
  For schema changes on a database use `notion-update-data-source`.
- **Workspace metadata** → `notion-get-teams` and `notion-get-users`
  before doing user-mention work; never hardcode user IDs.

Avoid enumerating all pages in a workspace via repeated search calls
when a database query would do.

## Common error decoding

| Status | Meaning | Action |
|---|---|---|
| 401 | Integration token rejected | Stop; report config issue |
| 403 | Integration lacks permission on this page | Stop; the page needs to be re-shared with the integration |
| 404 | Page/block not found OR not shared with integration | Treat as "not reachable" — do not retry |
| 409 | Conflict: someone else edited the page mid-update | Re-fetch, re-apply, retry once |
| 429 | Throttled | Wait ~1s, resume |
| 502 / 503 | Transient Notion backend | Retry with backoff, max 3 attempts |

A 403 should not be retried — fix the share and re-run.

## Common gotchas

- **Rich text is an array, not a string.** Notion blocks store text
  as `rich_text: [{type: "text", text: {content: "..."}}]`. Tools
  that expect plain strings will fail; flatten with a small helper.
- **Property types each need a different update shape.** A `title`
  property updates differently from `rich_text` differently from
  `select` differently from `multi_select`. Read the existing page
  with `notion-fetch` to see the property type before updating.
- **Pagination via `next_cursor`.** Search and database queries cap
  at 100 results per page. Skills that miss the cursor silently
  truncate. Always loop until `has_more` is false.
- **Archived pages appear in search.** Results include `archived:
  true` items by default. Filter them unless you specifically want
  archived pages.
- **Block depth is shallow.** `notion-fetch` returns the page's
  top-level blocks only. Nested toggles, columns, and synced blocks
  require recursive fetches on the child block IDs.
- **Search latency.** A page created via `notion-create-pages` may
  take 1–5 seconds to surface in `notion-search` results.
  Fetch-by-ID is immediate; prefer it when you just created the page.
- **`notion-create-comment` is for comments, not page bodies.**
  Comments are threaded discussion; to add content to a page use
  `notion-update-page` with new blocks.
