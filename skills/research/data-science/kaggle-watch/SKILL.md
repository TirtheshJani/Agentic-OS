---
name: kaggle-watch
description: Pull the latest Kaggle competitions, top notebooks, and dataset releases, and write a watch report highlighting items worth a deeper look. Use when the user asks for "kaggle update", "new competitions", "notable kaggle notebooks".
license: MIT
metadata:
  status: authored
  domain: research/data-science
  mode: remote
  mcp-server: none
  external-apis: [kaggle]
  outputs: [vault/wiki/research/data-science/kaggle-YYYY-MM-DD.md]
---

# kaggle-watch

Orchestration pattern: **multi-MCP coordination** (in the loose sense:
three independent Kaggle endpoints feed one digest). Competitions,
datasets, and notebooks are queried in parallel; each is independently
fail-soft. A missing block produces a "Notes" entry, not a failed run.

## References

- `references/kaggle-api.md` — auth file, endpoints, sort fields,
  response JSON shape. Consult before any CLI or HTTP call.
- Kaggle CLI docs: https://www.kaggle.com/docs/api (canonical when
  the local reference disagrees).

## Instructions

1. **Verify auth.** Check that `~/.kaggle/kaggle.json` exists and is
   readable. If not, write a Notes entry telling the user to install
   it and stop. Do not proceed without auth — Kaggle returns 401 with
   an HTML body that parses badly.

2. **Pin the date.** Use today in user TZ for the filename and header.
   Compute `since = today - window_days` as the cutoff for "new" items.

3. **Pull three lists in parallel.** Each call uses the CLI when
   available, raw HTTP as fallback. Cap each list at 50 results.

   - **Competitions:** `kaggle competitions list --sort-by recentlyCreated
     --page-size 50 -v` (CSV) or `--csv`. Parse to JSON; keep entries
     where `deadline >= today` (still open).
   - **Datasets:** `kaggle datasets list --sort-by published --page-size
     50 -v`. Filter `lastUpdated >= since` (or the dataset's `creationDate`
     if available).
   - **Notebooks (kernels):** `kaggle kernels list --sort-by hotness
     --page-size 50 -v`. Optionally narrow with `--competition <slug>`
     when `competition_filter` is set.

4. **Rank.** Sort each list:
   - Competitions: by `teamCount` descending (proxy for traction), break
     ties by `latestDeadline` ascending. Surface the top 10.
   - Datasets: by `totalVotes` descending if present, else by recency.
     Top 10.
   - Notebooks: by `totalVotes` descending. Top 10. Skip entries with
     `totalVotes < 5` unless the list is otherwise empty.

5. **Highlight items worth a deeper look.** Mark a competition with
   `(*)` if any of: (a) `tags` intersect `interest_tags`,
   (b) `reward` contains a dollar sign, (c) `teamCount >= 100` and
   `deadline` is more than 14 days out. Mark a notebook with `(*)`
   if `totalVotes >= 50` and its language is in `{Python, R}`.

6. **Compose the digest.** Sections in this order:

   ```
   # YYYY-MM-DD kaggle watch

   ## Competitions (open, sorted by traction)
   ## Datasets (added or updated in last <N> days)
   ## Notebooks (hottest)
   ## Notes
   ```

   Entry format:

   - Competition: `[<title>](<url>) — <category> · <teamCount> teams · deadline <YYYY-MM-DD> · <reward>`
   - Dataset: `[<title>](https://www.kaggle.com/datasets/<ref>) — <size> · <license> · <totalVotes>★ · updated <YYYY-MM-DD>`
   - Notebook: `[<title>](https://www.kaggle.com/code/<ref>) — <author> · <totalVotes>★ · <language>`

   Prefix highlighted entries with `(*)`.

7. **Write** to `vault/wiki/research/data-science/kaggle-<YYYY-MM-DD>.md`
   with the wiki frontmatter shape from `vault/CLAUDE.md`. Idempotent:
   re-running on the same date overwrites the file.

## Inputs

- `window_days` (optional, int). Recency window for datasets and
  notebooks. Default 7.
- `competition_filter` (optional, string). Restrict notebook list to
  a single competition slug.
- `interest_tags` (optional, list of strings). Tags that trigger the
  `(*)` highlight on competitions. Default `["tabular", "computer-vision",
  "nlp", "time-series"]`.
- `categories` (optional, list). Competition categories to include.
  Default `["Featured", "Research", "Playground"]`. "Getting Started"
  and "Community" excluded by default — too noisy.

## Outputs

- `vault/wiki/research/data-science/kaggle-<YYYY-MM-DD>.md` — the
  digest. Frontmatter `domain: research/data-science`,
  `source: kaggle-watch`.

## Wiki page template

```md
---
domain: research/data-science
source: kaggle-watch
created: <YYYY-MM-DD>
updated: <YYYY-MM-DD>
tags: [kaggle, competitions, datasets, notebooks]
---

# <YYYY-MM-DD> kaggle watch

> Open competitions, fresh datasets, and hot notebooks from the last <N> days.

## Competitions (open, sorted by traction)
(*) [Foo Challenge](https://www.kaggle.com/c/foo) — Featured · 412 teams · deadline 2026-08-01 · $50,000
- [Bar Playground](https://www.kaggle.com/c/bar) — Playground · 88 teams · deadline 2026-06-15

## Datasets (added or updated in last 7 days)
- [Some Dataset](https://www.kaggle.com/datasets/user/some-dataset) — 1.2 GB · CC0 · 34★ · updated 2026-05-12
...

## Notebooks (hottest)
(*) [EDA + LGBM baseline](https://www.kaggle.com/code/user/eda-lgbm) — user · 124★ · Python
...

## Notes
- Auth verified; CLI returned 50 / 50 / 50.
- 3 competitions hidden (category Getting Started).
```

## Examples

User: "kaggle update"

→ Today is 2026-05-13. Auth check passes. Parallel CLI calls return
38 open competitions (sorted by recency), 50 datasets (sorted by
published), 50 hot notebooks. Window is 7 days, so 14 datasets and
all 50 notebooks survive the filter. Ranking trims each to top 10.
Three competitions get `(*)`: one is tagged `tabular` (matches
interest), two have `teamCount > 100`. Two notebooks get `(*)` for
`totalVotes >= 50`. Digest written to
`vault/wiki/research/data-science/kaggle-2026-05-13.md` with a Notes
block recording filter counts.

User: "kaggle update, focus on cv competitions, window 14d"

→ `interest_tags=["computer-vision"]`, `window_days=14`. Same flow;
the highlight rule fires only on CV-tagged competitions. Digest
filename unchanged.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `kaggle: command not found` | CLI not installed in this venv | `pip install kaggle`; rerun |
| HTTP 401 from CLI | `~/.kaggle/kaggle.json` missing or wrong perms | Create file per `references/kaggle-api.md`; `chmod 600` |
| HTTP 429 | Burst over a few req/s | Sleep 30s, retry once; serialize the three list calls instead of parallel |
| Competition list empty | All competitions filtered out by category | Add `"Getting Started"` to `categories` or drop the filter |
| Notebook list dominated by one user | Hottest-by-votes leaderboard skew | Cap per-author at 2 in step 4 before truncating to top 10 |
| `deadline` parses as `null` | Some competitions have no fixed deadline (rolling) | Treat null as "open"; render deadline column as `rolling` |
| Digest has zero highlights | `interest_tags` too narrow | Either widen the tag list or accept that today is quiet — do not invent a highlight |
