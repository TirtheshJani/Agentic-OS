# Canva

The Canva MCP server exposes design search, generation, editing,
and export tooling against the connected Canva account. This ref is
the central source of rate limits, auth gotchas, and tool selection
for every skill that touches Canva (currently `newsletter-roundup`
and `draft-from-vault` for cover and hero graphics).

## Auth scopes

OAuth user-scoped via Canva Connect. Designs created via the MCP
server are owned by the connected user. Brand kits are user- or
team-scoped depending on the user's Canva plan.

| Capability | Access |
|---|---|
| Search and read designs owned by the connected user | configured |
| Generate new designs (AI) | configured |
| Edit designs (transactional) | configured |
| Export designs to file | configured |
| Read brand kits accessible to the connected user | configured |
| Read designs in teams the user isn't part of | not authorized |

## Rate limits

Canva Connect publishes per-user rate limits that vary by endpoint
family:

| Endpoint family | Limit |
|---|---|
| Read (`search-designs`, `get-design`, `list-*`) | 60 req/min |
| Edit transactions (`start-editing-transaction` and friends) | 30 req/min |
| Export (`export-design`) | 30 req/min |
| Generative (`generate-design`, `generate-design-structured`) | 5–10 per hour on consumer plans; higher on paid tiers |

These are platform numbers and may change. Generative endpoints are
the binding constraint for most workflows; design around them.

## Tool selection

Decision tree:

- **Brand-consistent design from scratch** → `generate-design-structured`
  (lets you constrain layout, palette, fonts via the brand kit) over
  `generate-design` (free-form, harder to keep on-brand).
- **Editing an existing design** → the transactional flow:
  1. `start-editing-transaction` (opens an edit lock)
  2. `perform-editing-operations` (one or more operations)
  3. `commit-editing-transaction` (required; locks release here)

  `cancel-editing-transaction` discards changes and releases the
  lock. **Uncommitted transactions leave the design in a locked
  state for up to 5 minutes** — always commit or cancel explicitly.
- **Downloadable output** → `get-export-formats` first (to confirm
  the format is available for this design type), then `export-design`.
- **Looking up existing assets/designs** → `search-designs` or
  `search-folders` over enumerating folders.
- **Inspecting before editing** → `get-design`, `get-design-content`,
  or `get-design-pages` depending on what you need.
- **Brand consistency** → `list-brand-kits` at the start of any
  generation flow; pass the chosen kit ID through to the generator.

## Common error decoding

| Status | Meaning | Action |
|---|---|---|
| 401 | Token rejected | Stop; refresh OAuth |
| 403 | Endpoint not in the user's plan, or design owned by another user | Stop; do not retry |
| 404 | Design or asset doesn't exist | Treat as "not reachable" |
| 409 | Editing transaction conflict (another session holds the lock) | Wait, retry once; if still locked, abort the run |
| 422 | Generation request rejected by content policy | Stop; surface to user — rephrase the prompt |
| 429 | Rate limit (often the generative hourly cap) | Honor `Retry-After`; for generative caps, fail fast and report |
| 500 / 503 | Transient Canva backend | Retry with backoff, max 2 attempts |

A 422 from `generate-design*` typically means the prompt tripped a
content-policy filter. Do not retry blindly — surface to the user.

## Common gotchas

- **Transactions must be explicitly closed.** A `start-editing-transaction`
  that never reaches `commit` or `cancel` locks the design for ~5
  minutes. Always wrap edits with a try/finally or its equivalent
  to ensure one of the two terminal calls fires.
- **`generate-design` is non-deterministic.** Re-running the same
  prompt yields different output. If you need a reproducible asset,
  generate once and reference the resulting design ID thereafter.
- **Brand-kit fonts don't export everywhere.** PDF and PNG preserve
  brand fonts; GIF and some video exports may substitute.
- **Asset upload via URL requires public reachability.**
  `upload-asset-from-url` needs the source URL to be publicly
  accessible. Signed URLs that expire mid-upload fail unpredictably.
- **A design has exactly one parent folder.** `move-item-to-folder`
  is a move, not a copy or link.
- **Thumbnails are cached briefly.** `get-design-thumbnail` returns
  a cached image for up to ~60 seconds after a commit. Fresh edits
  may not appear immediately; wait or accept the lag.
- **`generate-design-structured` requires a structured input schema.**
  Free-form text prompts only work with `generate-design`; for
  structured generation, supply the layout schema Canva expects.
- **Brand kit availability varies by plan.** Free-tier accounts may
  return an empty list from `list-brand-kits`. Skills should treat
  "no brand kit" as a normal case and fall back to default palettes.
