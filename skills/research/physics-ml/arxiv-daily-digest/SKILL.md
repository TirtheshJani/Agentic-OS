---
name: arxiv-daily-digest
description: Pull today's arXiv submissions in physics and ML categories, cluster into emergent themes, summarize each paper, and write a daily digest to vault/wiki/research/physics-ml/. Use when the user asks for "arxiv digest", "today's physics papers", "ML paper roundup", "what's new on arxiv".
license: MIT
metadata:
  status: authored
  domain: research/physics-ml
  mode: remote
  mcp-server: none
  external-apis: [arxiv]
  outputs: [vault/wiki/research/physics-ml/arxiv-YYYY-MM-DD.md]
---

# arxiv-daily-digest

Orchestration pattern: **sequential workflow**. Four ordered steps:
fetch → validate → cluster → summarize. Each step gates the next.
Same-day re-runs overwrite.

## References

- `references/services/arxiv.md` — endpoint, rate limits, query
  construction, gotchas.
- `references/arxiv-categories.md` (skill-local) — default category
  set this skill scans, shared with `morning-trend-scan`.
- `scripts/validators/validate_arxiv_atom.py` — confirm response
  shape before processing.

## Instructions

1. **Pin the date** (today, UTC). If before ~09:00 UTC, fall back to
   the previous UTC day. Note the fallback in the digest header.
2. **Fetch.** GET
   `https://export.arxiv.org/api/query?search_query=(<cats OR'd>)
   AND submittedDate:[YYYYMMDD0000 TO YYYYMMDD2359]&start=0&max_results=50`.
   If the result count == 50, fetch a second page with `start=50`,
   sleeping 3s between calls (see `references/services/arxiv.md`).
3. **Validate.**
   ```bash
   python3 scripts/validators/validate_arxiv_atom.py < /tmp/arxiv.xml
   ```
   Exit 0 → continue. Exit 1 → record errors in digest "Notes", drop
   malformed entries, continue with the good ones. Exit 2 → write a
   one-line "API unavailable" digest and stop.
4. **De-dupe** by stripped arXiv ID (drop `vN` suffix); a single paper
   may appear under multiple categories.
5. **Cluster into emergent themes**, not pre-defined ones. Read all
   abstracts; identify 3–6 themes from this batch (e.g. "Diffusion
   model efficiency", "Long-context attention", "Robotics policy
   learning"). Pre-defined themes drift from current research; let
   the day's batch define its own shape.
6. **Summarize each paper** under its theme: 2–3 sentences. Lead with
   the contribution, then the method, then the headline result if any.
   No author bios, no affiliations (arXiv API doesn't provide them).
7. **Write** to `vault/wiki/research/physics-ml/arxiv-YYYY-MM-DD.md`
   with frontmatter:
   ```yaml
   ---
   domain: research/physics-ml
   source: arxiv-daily-digest
   created: YYYY-MM-DD
   updated: YYYY-MM-DD
   tags: [<theme slugs>]
   ---
   ```
8. **One re-run a day**. If the file exists, overwrite (the upstream
   batch is the same; clustering may shift if late papers landed).

## Inputs

- `categories` (optional, list). Default from
  `references/arxiv-categories.md`.
- `date` (optional, ISO 8601). Default: today UTC (with pre-09:00
  fallback).
- `max_papers` (optional, int). Default: 100 (two pages).

## Outputs

- `vault/wiki/research/physics-ml/arxiv-<YYYY-MM-DD>.md`

## Examples

User: "arxiv digest"

→ 12 today-submitted papers across cs.LG / stat.ML / physics.med-ph.
Validator passes. Themes emerge: "Diffusion sampling" (4), "Attention
variants" (3), "Medical imaging" (2), "Misc" (3). Writes
`arxiv-2026-05-11.md`:

```md
---
domain: research/physics-ml
source: arxiv-daily-digest
created: 2026-05-11
updated: 2026-05-11
tags: [diffusion-sampling, attention-variants, medical-imaging]
---

# arXiv 2026-05-11

## Diffusion sampling

### [Faster sampling via ...](http://arxiv.org/abs/2605.00012)
Authors: Alice Example et al. · primary: cs.LG
Proposes a ... Achieves 3x speedup over DDIM at comparable FID.
...
```

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Digest empty before 09:00 UTC | Today's arXiv batch not yet published | Fall back to previous UTC day (built-in) |
| Validator exit 2 | API returned HTML error page | Retry once after 60s; if still 2, write "API unavailable" stub |
| Duplicate papers across themes | Cross-listing not de-duped | De-dupe by stripped ID before clustering, not after |
| Themes feel forced | Batch too small for emergent clustering | If <6 papers, collapse into a single "Today" section |
| Author count off | Atom permits N `<author>` children | Iterate `entry.findall("author")`, don't index [0] only |
