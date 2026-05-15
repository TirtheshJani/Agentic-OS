---
domain: coding
source: promoted-from-raw
created: 2026-05-15
updated: 2026-05-15
tags: [mcp, github-mcp, claude-code, network, webfetch, arxiv, ops]
---

# MCP and network-availability gotchas in Claude Code sessions

Operational pattern observed repeatedly across morning-scan and daily-rollup
runs: scans degrade silently when a required MCP server isn't attached or
when the session's outbound network policy blocks an upstream API. The
skills don't always fail loud — they emit empty sections or fall back to
worse data sources without telling the caller why.

## Failure modes seen so far

### GitHub MCP not attached

Recurs in every rollup so far. The skills assume the `github` MCP server is
present and call `search_repositories` / commit-history endpoints; when it's
missing, the skill either skips the GitHub section or scrapes
`github.com/trending` via `WebFetch`, which returns cumulative star totals
rather than the 7-day creation window the skill actually wants.

Examples:

- `2026-05-13-rollup.md`: "GitHub MCP not attached — commit history and PR
  activity for `tirtheshjani/agentic-os` could not be fetched."
- `2026-05-14-rollup.md`: "GitHub skipped — GitHub MCP not attached to this
  session."
- `2026-05-15-morning-scan.md`: trending section "sourced from
  `github.com/trending` (today's trending page) via WebFetch rather than the
  `search_repositories` 7-day creation-window query specified by the
  skill."

### Outbound HTTP blocked

The morning-scan skill needs `api.github.com` and `export.arxiv.org`. When
either is denied, the skill records a soft failure and emits an empty
section.

- `2026-05-10-morning-scan.md`: WebFetch and `curl`/`Invoke-WebRequest`
  approval was not granted, so neither the GitHub search nor the arXiv
  Atom query was issued.
- `2026-05-15-morning-scan.md`: "All requests to `export.arxiv.org`
  returned HTTP 403 Forbidden. This environment's outbound network policy
  blocks the arXiv Atom API endpoint."

## Fix checklist before running a scan

1. **Attach the GitHub MCP server** for any skill that touches commits,
   PRs, releases, or repo metadata. Trending-page scraping is a fallback,
   not a substitute.
2. **Pre-approve WebFetch** (or `curl`) for the exact hosts the skill
   declares: `api.github.com`, `export.arxiv.org`, plus any per-skill
   third parties.
3. **Validate the arXiv Atom payload** via
   `scripts/validators/validate_arxiv_atom.py` after the fetch — empty or
   403 responses still parse as valid XML otherwise.
4. **Check UTC window math.** The morning-scan defaults to today's UTC
   day; if the system clock is already past midnight UTC, the previous-day
   fallback should kick in. `2026-05-10-morning-scan.md` documented the
   manual check.

## Why this matters

Silent degradation breaks the trust contract with downstream skills. A
rollup that says "no GitHub activity today" is indistinguishable from "the
MCP server was missing" — and the latter is recoverable by re-running with
the right config. Skills should fail loud (non-zero exit, explicit
`status: error` in frontmatter, or an `Escalations` section) rather than
emit an empty bullet list.

## Source raw notes

See also:

- [[raw/daily/2026-05-10-morning-scan]]
- [[raw/daily/2026-05-13-rollup]]
- [[raw/daily/2026-05-14-rollup]]
- [[raw/daily/2026-05-15-morning-scan]]
