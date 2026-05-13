---
name: healthcare-arxiv
description: Pull arXiv submissions in q-bio and physics.med-ph categories, filter for healthcare-tech relevance, summarize, and write to vault/wiki/research/healthcare-tech/. Use when the user asks for "healthcare arxiv", "q-bio digest", "medical AI papers today".
license: MIT
metadata:
  status: authored
  domain: research/healthcare-tech
  mode: remote
  mcp-server: none
  external-apis: [arxiv]
  outputs: [vault/wiki/research/healthcare-tech/arxiv-YYYY-MM-DD.md]
---

# healthcare-arxiv

Orchestration pattern: **sequential workflow** with one
keyword-filter stage. Five ordered steps: fetch → validate → de-dupe
→ filter-for-healthcare → summarize. Each step gates the next.
Same-day re-runs overwrite.

## References

- `references/services/arxiv.md` — endpoint, 3-second rate limit, ID
  extraction, today vs. yesterday batch.
- `references/categories.md` (skill-local) — q-bio subcategories,
  physics.med-ph scope, ML categories scanned for healthcare keywords,
  the keyword filter list.
- `scripts/validators/validate_arxiv_atom.py` — confirm response
  shape before iterating.

## Instructions

1. **Pin the date** (today, UTC). If before ~09:00 UTC, fall back to
   the previous UTC day and note that in the digest header.

2. **Fetch two query buckets** with a 3-second sleep between them:

   **Bucket A — explicit healthcare categories** (no keyword filter
   needed, every paper counts):
   ```
   (cat:q-bio.BM OR cat:q-bio.CB OR cat:q-bio.GN OR cat:q-bio.MN OR
    cat:q-bio.NC OR cat:q-bio.OT OR cat:q-bio.PE OR cat:q-bio.QM OR
    cat:q-bio.SC OR cat:q-bio.TO OR cat:physics.med-ph OR cat:stat.AP)
   AND submittedDate:[YYYYMMDD0000 TO YYYYMMDD2359]
   ```
   `max_results=50`. Page once with `start=50` if the first page is
   full.

   **Bucket B — ML categories filtered for healthcare keywords**
   (catches "ML for X medical task" papers that primary-list under
   cs.LG):
   ```
   (cat:cs.LG OR cat:cs.CV OR cat:cs.CL)
   AND submittedDate:[YYYYMMDD0000 TO YYYYMMDD2359]
   ```
   `max_results=50`. Page once. The keyword filter runs in step 5.

   Sleep ≥3 seconds between every API call (see
   `references/services/arxiv.md`).

3. **Validate each response.**
   ```bash
   python3 scripts/validators/validate_arxiv_atom.py < /tmp/arxiv_bucketA.xml
   python3 scripts/validators/validate_arxiv_atom.py < /tmp/arxiv_bucketB.xml
   ```
   Exit 0 → continue. Exit 1 → record malformed entry count in the
   digest "Notes", drop those entries, continue with the rest. Exit 2
   on either bucket → back off 60s, retry once; on second exit 2
   write a one-line "API unavailable" stub and stop.

4. **De-dupe** by stripped arXiv ID (drop the `vN` suffix). A paper
   cross-listed in q-bio.QM and cs.LG must appear once.

5. **Healthcare-keyword filter on bucket B.** For each bucket-B paper,
   match title + abstract against the keyword list in
   `references/categories.md` (e.g. `clinical`, `radiology`,
   `pathology`, `EHR`, `ICU`, `electronic health record`, `medical
   imaging`, `patient`, `diagnosis`). Keep papers with ≥1 match. Drop
   the rest. Bucket A papers pass through unfiltered.

6. **Summarize each surviving paper.** Two to three sentences. Lead
   with the contribution, then the method, then the headline result
   if any. Mark the matched healthcare keywords in italics for
   bucket-B entries so the user can audit the filter.

7. **Group by primary category** (one heading per primary cat) and
   write to
   `vault/wiki/research/healthcare-tech/arxiv-<YYYY-MM-DD>.md` with
   the wiki frontmatter from `vault/CLAUDE.md`. Idempotent on the
   date slug.

## Inputs

- `date` (optional, ISO 8601). Default: today UTC with pre-09:00
  fallback.
- `keywords` (optional, list). Override the default healthcare
  keyword list from `references/categories.md`.
- `include_ml_filter` (optional, bool). Default `true`. If `false`,
  skip bucket B entirely (q-bio + physics.med-ph only).
- `max_papers` (optional, int). Per-bucket cap. Default `100`.

## Outputs

- `vault/wiki/research/healthcare-tech/arxiv-<YYYY-MM-DD>.md`

## Examples

User: "healthcare arxiv"

→ Today: bucket A returns 14 papers across q-bio.QM (8),
physics.med-ph (4), stat.AP (2). Bucket B returns 47 papers across
cs.LG/cs.CV/cs.CL; keyword filter keeps 9 (5 mention `radiology`,
3 mention `clinical`, 1 mentions `EHR`). De-dupe drops one paper
cross-listed in q-bio.QM and cs.LG. Total: 22 papers. Writes
`arxiv-2026-05-13.md`:

```md
---
domain: research/healthcare-tech
source: healthcare-arxiv
created: 2026-05-13
updated: 2026-05-13
tags: [q-bio-qm, physics-med-ph, medical-imaging]
---

# Healthcare arXiv 2026-05-13

> 14 papers from q-bio/physics.med-ph/stat.AP; 9 from cs.LG/cs.CV/cs.CL
> matching healthcare keywords; 1 cross-listing de-duped.

## q-bio.QM

### [Foundation models for ...](http://arxiv.org/abs/2605.00045)
Authors: Alice Example et al. · primary: q-bio.QM
Proposes a ... Trained on ... Reports AUROC 0.89 on the MIMIC-IV
mortality task.

## physics.med-ph
...

## cs.LG (healthcare-filtered)

### [Distillation of ...](http://arxiv.org/abs/2605.00123)
Authors: Bob Example et al. · primary: cs.LG
Matched keywords: *radiology*, *clinical*.
Distills a 7B vision-language model ...
```

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Digest empty before 09:00 UTC | Today's arXiv batch not yet published | Fall back to previous UTC day (built-in) |
| HTTP 503 on second query | Burst tripped the 3s rule between buckets | Sleep ≥3s between every call, even across buckets |
| Bucket B keeps zero papers after filter | Keyword list too narrow for current vocabulary | Widen via `keywords` input; add `chest x-ray`, `histopathology`, etc. |
| Same paper appears in two sections | Cross-listing not de-duped | De-dupe by stripped ID before grouping, not after |
| stat.AP heading is mostly non-medical stats | stat.AP is a broad category | Re-classify it as bucket B and apply the keyword filter |
| Validator exit 2 on bucket A | API returned HTML error page | Back off 60s, retry once; on second failure write "API unavailable" stub |
| Author count off in entries | Atom permits N `<author>` children | Iterate all `<author>` elements; don't index [0] only |
