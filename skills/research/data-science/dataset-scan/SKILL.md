---
name: dataset-scan
description: Scan public dataset registries (HuggingFace Datasets, OpenML, data.gov) for new datasets matching the user's tracked tags, and write a curated list with size, license, and applicability notes. Use when the user asks for "new datasets", "dataset scan", "find datasets for X".
license: MIT
metadata:
  status: authored
  domain: research/data-science
  mode: remote
  mcp-server: none
  external-apis: [huggingface, openml, datagov]
  outputs: [vault/wiki/research/data-science/datasets-YYYY-MM-DD.md]
---

# dataset-scan

Orchestration pattern: **multi-MCP coordination**. Three independent
registry APIs (Hugging Face, OpenML, data.gov/CKAN) fan out in
parallel, each is normalized to a common row shape, then merged into
one curated wiki page. Any registry that fails records a Notes
entry; the digest still ships with whatever survived.

## References

- `references/registries.md` — endpoints, sort fields, response
  shape for each registry, and the normalization schema. Consult
  before any HTTP call.
- `vault/CLAUDE.md` — wiki frontmatter and naming.

## Instructions

1. **Pin the date.** Use today in user TZ for the filename and header.
   Compute `since = today - window_days` as the recency cutoff.

2. **Resolve topics.** Each `topic` in `topics` becomes one search
   string per registry. Topics are case-insensitive substrings;
   expand common synonyms manually if needed (e.g. `cv` →
   `computer-vision`). Cap total queries at `len(topics) * 3`.

3. **Fan out per registry.** Run all queries in parallel; per
   registry, serialize page calls with 1s sleep between pages.

   - **Hugging Face:**
     `GET https://huggingface.co/api/datasets?search=<topic>&sort=lastModified&direction=-1&limit=100&full=true`.
     Keep rows where `lastModified >= since`.
   - **OpenML:**
     `GET https://www.openml.org/api/v1/json/data/list/data_name/<topic>/limit/200`.
     Filter client-side: keep rows where `upload_date >= since` and
     `status == "active"`.
   - **data.gov (CKAN):**
     `GET https://catalog.data.gov/api/3/action/package_search?q=<topic>&rows=50&sort=metadata_modified+desc`.
     Keep rows where `metadata_modified >= since`.

4. **Normalize.** Map every result to the shared row shape in
   `references/registries.md` §"Common normalization". Each row
   carries its origin in `source` and the matching input topic in
   `topic_match`.

5. **Dedupe and merge.** Build a global list keyed by
   `(source, id)`; identical rows from overlapping topics collapse
   to one row whose `topic_match` becomes the comma-joined union.
   Across registries the same dataset may appear under different
   IDs — accept the duplication; mention in Notes if it looks
   excessive (more than 20 percent overlap).

6. **Rank within registry.**
   - Hugging Face: by `downloads_or_proxy` descending.
   - OpenML: by `NumberOfInstances` descending (proxy for usefulness),
     break ties by recency.
   - data.gov: by `metadata_modified` descending.
   Take the top `top_n_per_registry` from each (default 10).

7. **Annotate applicability.** For each surviving row add a short
   `note` field built from heuristics:
   - License absent or `unknown` → note `license unclear, verify
     before use`.
   - HF `size_categories` includes `n>1T` or OpenML
     `NumberOfInstances > 10_000_000` → note `large; expect
     streaming or sampling`.
   - data.gov resources list contains only `HTML` or `PDF` formats
     (no raw data) → note `metadata-only, not a downloadable dataset`.
   - Row's tags or title contain known sensitive terms (e.g.
     `medical`, `clinical`, `pii`) → note `sensitive domain, check
     license + IRB applicability`.

8. **Compose the wiki page.** Sections by registry, in this order:

   ```
   # YYYY-MM-DD dataset scan: <comma-joined topics>

   ## Hugging Face Datasets
   ## OpenML
   ## data.gov
   ## Notes
   ```

   Entry format (single line per dataset):
   `[<title>](<url>) — <size> · <license> · <downloads_or_proxy>↓ · updated <YYYY-MM-DD> · topic: <topic_match>  
     note: <note or omit line if empty>`

9. **Write** to `vault/wiki/research/data-science/datasets-<YYYY-MM-DD>.md`
   with the wiki frontmatter from `vault/CLAUDE.md`. Idempotent on
   the day; re-running overwrites.

## Inputs

- `topics` (required, list of strings). Search terms; each is
  queried against every registry. Example: `["graph neural
  networks", "time series forecasting"]`.
- `window_days` (optional, int). Recency cutoff. Default 30 — a
  scan is rarely useful below a month because OpenML and data.gov
  publish slowly.
- `top_n_per_registry` (optional, int). Default 10.
- `registries` (optional, list). Subset of
  `["huggingface", "openml", "datagov"]`. Default all three.
- `licenses_allowed` (optional, list). If provided, filter rows
  whose `license` is not in this list. Common values: `mit`,
  `apache-2.0`, `cc0-1.0`, `cc-by-4.0`.

## Outputs

- `vault/wiki/research/data-science/datasets-<YYYY-MM-DD>.md` —
  the curated list. Frontmatter `domain: research/data-science`,
  `source: dataset-scan`.

## Wiki page template

```md
---
domain: research/data-science
source: dataset-scan
created: <YYYY-MM-DD>
updated: <YYYY-MM-DD>
tags: [datasets, <topic-slugs>]
---

# <YYYY-MM-DD> dataset scan: <comma-joined topics>

> Last <N> days across Hugging Face, OpenML, data.gov.

## Hugging Face Datasets
- [Foo Corpus](https://huggingface.co/datasets/org/foo) — 1B rows · apache-2.0 · 12500↓ · updated 2026-05-10 · topic: nlp
- ...

## OpenML
- [bar-dataset (v3)](https://www.openml.org/d/12345) — 50000 rows · CC-BY · updated 2026-05-08 · topic: tabular
  note: license unclear, verify before use

## data.gov
- [Baz Survey 2025](https://catalog.data.gov/dataset/baz-2025) — 240 MB CSV · US Gov Works · updated 2026-05-09 · topic: time-series
  note: sensitive domain, check license + IRB applicability

## Notes
- HF returned 318 rows pre-filter, 27 post-recency, top 10 surfaced.
- OpenML query for "graph neural networks" returned 0 — registry has no native graph tag.
- data.gov pages 3-5 timed out; reported top 10 from pages 1-2 only.
```

## Examples

User: "dataset scan for graph neural networks and time series forecasting"

→ Topics = `["graph neural networks", "time series forecasting"]`,
window 30d. Six parallel queries (2 topics × 3 registries). HF
yields 318 rows for GNN, 412 for TSF; OpenML yields 0 for GNN, 87
for TSF; data.gov yields 4 for GNN, 53 for TSF. Recency filter
trims to 27 / 64 / 0 / 51 / 4 / 41. Top-10 per registry surfaces.
One HF dataset matches both topics → `topic_match: "graph neural
networks, time series forecasting"`. Three rows get
`license unclear` notes. Digest written to
`vault/wiki/research/data-science/datasets-2026-05-13.md`.

User: "find datasets for medical imaging, mit or apache only"

→ Topics = `["medical imaging"]`, `licenses_allowed=["mit",
"apache-2.0"]`. After license filter, HF surfaces 4 rows, OpenML 0,
data.gov 0. All four get `sensitive domain` notes from the
medical-keyword heuristic.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| HF returns 200 but empty list | Query string had stray quotes | URL-encode `topic`; do not wrap in quotes |
| OpenML returns HTML | API path missing `json/` segment | Use `/api/v1/json/data/list/...`, not `/api/v1/data/list/...` |
| data.gov 504 | Catalog frontend slow under load | Retry once after 10s; if still 504, skip and Notes-log |
| Same dataset in HF and OpenML | Cross-mirrored corpora are common | Acceptable duplication; flag in Notes if >20% of rows |
| All notes say `license unclear` | Registry's cardData empty | Verify by following one URL by hand; OpenML often lacks license metadata even when the dataset is public-domain |
| Window filter drops everything | OpenML upload dates are sparse | Widen `window_days` to 90, or drop the filter for OpenML only |
| `licenses_allowed` filter empties HF | HF tags use SPDX-lowercase | Pass licenses in lowercase (`apache-2.0`, not `Apache-2.0`) |
