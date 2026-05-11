---
name: morning-trend-scan
description: Scan GitHub trending repos plus the day's arXiv submissions in the user's tracked categories and write a brief morning digest to vault/raw/daily/. Use at the start of the workday or when the user asks for "morning scan", "what's trending", "daily tech roundup", "what's new today".
license: MIT
metadata:
  status: authored
  domain: research/general
  mode: remote
  mcp-server: github
  external-apis: [arxiv]
  outputs: [vault/raw/daily/YYYY-MM-DD-morning-scan.md]
---

# morning-trend-scan

Orchestration pattern: **multi-MCP coordination**. Two independent
sources (GitHub search, arXiv Atom). Both feed a single digest. Each
source is independently fail-soft.

## References

- `references/services/github.md` — search vs. read tools, 403
  disambiguation, secondary rate limit handling.
- `references/services/arxiv.md` — 3-second-per-request rule, today's
  vs. yesterday's batch, ID extraction.
- `skills/research/physics-ml/arxiv-daily-digest/references/arxiv-categories.md`
  — default category list, shared with `arxiv-daily-digest` for
  coherence between the two skills.
- `scripts/validators/validate_arxiv_atom.py` — confirm the arXiv
  response parses before iterating entries.

## Instructions

1. **Pin the date** (today in user TZ). Before ~09:00 UTC the arXiv
   "today" bucket is empty; fall back to the previous UTC day and
   note that in the digest header.
2. **Fetch in parallel:**
   - **GitHub:** there is no public trending API. Approximate via
     `search_repositories` with
     `language:<top-languages> created:>YYYY-MM-DD sort:stars`,
     `YYYY-MM-DD` = today − 7 days. Top languages default to
     `python,typescript,rust,go`. Take top 8 by stars.
   - **arXiv:** GET
     `https://export.arxiv.org/api/query?search_query=(cat:cs.LG OR
     cat:stat.ML OR cat:cs.AI) AND submittedDate:[YYYYMMDD0000 TO
     YYYYMMDD2359]&max_results=50`. Sleep 3s between any retries.
3. **Validate the arXiv response.**
   ```bash
   python3 scripts/validators/validate_arxiv_atom.py < /tmp/arxiv.xml
   ```
   Exit 0 → iterate entries. Exit 1 → log the listed errors in the
   digest's "Notes" section and skip the arXiv block. Exit 2 → API
   returned an error HTML page; back off 60s and retry once.
4. **Compose the digest.** Sections in this order:
   ```
   # YYYY-MM-DD morning scan

   ## GitHub (created in last 7d, sorted by stars)
   ## arXiv (today, <category list>)
   ## Notes
   ```
   GitHub entries: `[name](url) — stars · 1-line description`.
   arXiv entries: `[title](abs URL) — primary cat · authors[0] et al.`
   Strip arXiv version suffix (`v1`, `v2`) from the ID for stability.
5. **Write** to `vault/raw/daily/<YYYY-MM-DD>-morning-scan.md`.
   Idempotent: re-running on the same day overwrites the file.

## Inputs

- `languages` (optional, list). Default: `["python","typescript","rust","go"]`.
- `arxiv_categories` (optional, list). Default: shared list from
  `arxiv-daily-digest/references/arxiv-categories.md`.
- `window_days` (optional, int). GitHub creation window. Default: 7.

## Outputs

- `vault/raw/daily/<YYYY-MM-DD>-morning-scan.md`

## Examples

User: "morning scan"

→ Today: GitHub returns 8 repos created in the last 7 days, top by
stars in py/ts/rust/go. arXiv returns 12 today-submitted papers across
cs.LG / stat.ML / cs.AI. Validator passes. Digest written:

```md
# 2026-05-11 morning scan

## GitHub (created in last 7d, sorted by stars)
- [foo/bar](https://github.com/foo/bar) — 2.1k★ · in-process embedding store
- ...

## arXiv (today, cs.LG / stat.ML / cs.AI)
- [Scaling laws for ...](http://arxiv.org/abs/2605.00001) — cs.LG · Alice Example et al.
- ...

## Notes
- arXiv bucket pulled from yesterday's UTC day (it's 07:42 UTC, today's batch is empty).
```

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| arXiv block empty, no error | Run before ~09:00 UTC | Fall back to previous UTC day; mention in Notes |
| GitHub 403 "secondary rate limit" | Burst tripped | Wait `Retry-After` seconds, retry once |
| All GitHub entries are forks | Forks dominate creation date | Add `fork:false` to the search query |
| Validator exit 2 | arXiv returned HTML (503 page) | Back off 60s, retry once; if still 2, write Notes entry and skip arXiv |
| Same paper appears under two categories | Cross-listing | De-dupe by stripped arXiv ID before formatting |
