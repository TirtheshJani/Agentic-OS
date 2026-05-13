---
name: benchmark-tracker
description: Track changes in named ML benchmarks (PapersWithCode SOTA tables, GLUE, MMLU, etc.) and write a delta report when a previous-best is beaten. Use when the user asks for "benchmark update", "new SOTA", "track [benchmark]".
license: MIT
metadata:
  status: authored
  domain: research/data-science
  mode: remote
  mcp-server: none
  external-apis: [paperswithcode]
  outputs: [vault/wiki/research/data-science/benchmarks-YYYY-MM-DD.md]
---

# benchmark-tracker

Orchestration pattern: **iterative refinement** over time. Each run
generates the current top-1 per tracked benchmark, validates the
result against the prior run's snapshot, and writes a delta. The
prior snapshot lives in the most recent `benchmarks-*.md` file in
the same wiki folder — that page is both the output and the state
store. No external database.

## References

- `references/benchmarks.md` — the default tracked-benchmark list
  with PWC task slugs, metric names, and the PWC + HF Open LLM
  leaderboard endpoint shape. Verify any new slug against PWC
  before adding it to the list.
- `vault/CLAUDE.md` — wiki frontmatter and naming.

## Instructions

1. **Load the watchlist.** If `benchmarks` input is provided, use
   it. Otherwise read the default table in
   `references/benchmarks.md`. Each entry has `label`, `pwc_slug`,
   `metric`, `higher_is_better`.

2. **Load the prior snapshot.** List
   `vault/wiki/research/data-science/benchmarks-*.md` sorted by
   filename descending; pick the first that is strictly older than
   today's filename. Parse its "Current top-1 per benchmark" table
   into `{label: {value, model, paper_url, captured_on}}`. If no
   prior snapshot exists, this is the first run — note in the
   report header and skip the delta block.

3. **Fetch current top-1 per benchmark.** For each watchlist row,
   query:
   ```
   GET https://paperswithcode.com/api/v1/tasks/<pwc_slug>/evaluations/?page=1
   ```
   Pull pages 1-3. Pause 1s between pages. Per row, filter
   evaluations to those reporting the configured metric name, sort
   by metric value (descending if `higher_is_better`, else
   ascending), and take row 0. Record `value`, `model_name`,
   `paper.title`, `paper.url`, `evaluation_date`.

4. **Fallback per benchmark.** If PWC returns zero matching rows
   AND the benchmark label is one of `{MMLU, HellaSwag, ARC-Challenge,
   GSM8K, HumanEval}`, fetch the HF Open LLM Leaderboard HTML and
   parse the column for that benchmark. Record `source:
   hf-leaderboard` on the row. If neither source returns data, mark
   the row `unavailable` with the failure reason in Notes — do not
   carry the prior value forward.

5. **Compute deltas.** For each benchmark with both a prior and a
   current value:
   - `delta = current.value - prior.value` (signed).
   - `improved = (delta > 0) if higher_is_better else (delta < 0)`.
   - `regressed = (delta < 0) if higher_is_better else (delta > 0)`.
   A regression is rare and usually means the prior leader was
   retracted or the leaderboard rules changed; surface those
   explicitly in the report.

6. **Validate.** For each `improved` row, sanity-check:
   - `evaluation_date` is no more than 60 days old.
   - `paper.url` resolves (HEAD request; 4xx/5xx → flag).
   - `model_name` is not literally `None` or empty.
   If any validation fails, keep the row but tag it `(unverified)`
   in the report. Do not silently drop it.

7. **Compose the report.** Sections in this order:

   ```
   # YYYY-MM-DD benchmark tracker

   ## Movers (improved vs prior snapshot)
   ## Regressions
   ## Current top-1 per benchmark
   ## Unavailable
   ## Notes
   ```

   - **Movers** table columns: `Benchmark | New top-1 | Δ | Prior | Model | Paper`.
   - **Current top-1** table is the durable state for the next
     run; include every benchmark whose fetch succeeded.
   - Suppress the **Movers** section entirely on the first-ever run
     (no prior to diff against).

8. **Write** to `vault/wiki/research/data-science/benchmarks-<YYYY-MM-DD>.md`
   with wiki frontmatter. Idempotent: re-running on the same date
   overwrites that day's file but does not touch the prior
   snapshot (the diff base remains the most-recent strictly older
   file).

## Inputs

- `benchmarks` (optional, list of objects). Override the default
  watchlist. Each object: `{label, pwc_slug, metric, higher_is_better}`.
- `min_delta` (optional, float). Smallest signed change worth
  surfacing in the Movers table. Default 0.001 (i.e. any
  improvement at all on a 0-1 metric). Bench-specific units differ;
  match the metric's natural unit.
- `lookback` (optional, int days). Override the
  `evaluation_date` freshness check in step 6. Default 60.

## Outputs

- `vault/wiki/research/data-science/benchmarks-<YYYY-MM-DD>.md` —
  the diff report and the next run's state.

## Wiki page template

```md
---
domain: research/data-science
source: benchmark-tracker
created: <YYYY-MM-DD>
updated: <YYYY-MM-DD>
tags: [benchmarks, sota, paperswithcode]
---

# <YYYY-MM-DD> benchmark tracker

> Diff vs snapshot dated <PRIOR-YYYY-MM-DD>.

## Movers (improved vs prior snapshot)
| Benchmark | New top-1 | Δ | Prior | Model | Paper |
|---|---|---|---|---|---|
| MMLU (5-shot) | 0.892 | +0.014 | 0.878 | Foo-70B | [Title](https://paperswithcode.com/paper/...) |
| HumanEval (pass@1) | 0.94 | +0.02 | 0.92 | Bar-Coder | [Title](...) |

## Regressions
_None._

## Current top-1 per benchmark
| Benchmark | Top-1 | Model | Captured |
|---|---|---|---|
| ImageNet (top-1) | 0.912 | Baz-ViT | 2026-05-09 |
| MMLU (5-shot) | 0.892 | Foo-70B | 2026-05-12 |
| ... | ... | ... | ... |

## Unavailable
- GSM8K (test): PWC returned 0 matching rows; HF leaderboard fetch 504.

## Notes
- Source overrides used: HellaSwag, ARC-Challenge (HF leaderboard fresher than PWC).
- 1 row tagged (unverified): paper URL 404 on HumanEval mover.
```

## Examples

User: "benchmark update"

→ Today is 2026-05-13. Prior snapshot found at
`benchmarks-2026-05-06.md`. Watchlist has 9 default rows. Nine PWC
queries (1s apart) succeed; one falls back to HF leaderboard. Diff
computed: 2 improvements (MMLU +0.014, HumanEval +0.02), no
regressions, 1 unavailable (GSM8K — both sources down). Report
written to `vault/wiki/research/data-science/benchmarks-2026-05-13.md`.

User: "track only mmlu and humaneval, min_delta=0.005"

→ Custom watchlist of 2 rows. Same flow. MMLU's +0.014 surfaces,
HumanEval's +0.02 surfaces. If MMLU had moved +0.003 it would be
suppressed from Movers (below `min_delta`) but still appear in
Current top-1.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| PWC slug returns 404 | Slug was renamed or list is stale | Open `https://paperswithcode.com/sota` and search for the benchmark; update `references/benchmarks.md` |
| All evaluations have no metric value | API returned metrics in a string envelope | Check the metric name matches PWC's spelling exactly (case + punctuation); some say `Top 1 Accuracy`, some `Top-1 Accuracy` |
| Prior snapshot parse fails | Markdown table edited by hand | Re-render the prior file from its tracked state; do not patch in place |
| Same model appears as new each week | Evaluation entry's `evaluation_date` changes on every refresh | Match on `(model_name, value)` not on entry ID when diffing |
| HF leaderboard fallback produces NaN | HTML parse picked up the header row | Skip rows where the metric cell is non-numeric; log in Notes |
| Regression flagged for SOTA that was retracted upstream | PWC removed the row | Treat as `unavailable` for one run, then drop from Current top-1 on the next run if still missing |
| Report empty Movers but you expect activity | Prior snapshot is the same day's run earlier | The diff base is the most-recent strictly older file; re-running same-day cannot show movers |
