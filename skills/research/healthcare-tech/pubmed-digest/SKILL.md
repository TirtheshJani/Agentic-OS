---
name: pubmed-digest
description: Run a PubMed query for a condition, intervention, or methodology and write a structured digest with study designs, sample sizes, and effect sizes to vault/wiki/research/healthcare-tech/. Use when the user asks for "pubmed search on X", "medical literature on X", "recent studies on X".
license: MIT
metadata:
  status: authored
  domain: research/healthcare-tech
  mode: remote
  mcp-server: none
  external-apis: [pubmed]
  outputs: [vault/wiki/research/healthcare-tech/<query-slug>.md]
---

# pubmed-digest

Orchestration pattern: **sequential workflow**. Five ordered stages
(plan → esearch → esummary → efetch-and-extract → synthesize). Each
stage gates the next; failure at any stage halts and writes a stub
digest noting the failure.

## References

- `references/services/pubmed.md` — endpoints, auth, rate limits,
  query syntax cheatsheet. Consult before composing any query.
- `scripts/validators/validate_pubmed_esummary.py` — confirms the
  ESummary JSON response carries the per-record fields stage 3 reads.
- `vault/CLAUDE.md` — wiki frontmatter shape and naming rules.

## Instructions

1. **Plan the query.** Restate the user's topic in one sentence. Pick
   a kebab-case `<query-slug>` (≤40 chars). Translate the topic into
   PubMed syntax using field tags (`[MeSH]`, `[Title/Abstract]`,
   `[Publication Type]`). Default filters unless the user overrides:
   - `humans[MeSH Terms]`
   - `english[Language]`
   - publication date in the last `window_days` (default 365)
   - exclude `Retracted Publication[Publication Type]`
   Log the final query string in the digest header.

2. **ESEARCH for PMIDs.** GET
   `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=<URL-encoded query>&retmax=<max_results>&sort=date&retmode=json&tool=agentic-os&email=tirtheshjani@gmail.com`.
   Parse `esearchresult.idlist`. If empty, stop and write a stub
   noting zero hits and the exact query. If `>max_results`, log the
   total in the Notes section so the user knows the result is capped.

3. **ESUMMARY for metadata.** Chunk the PMID list at 200 per call.
   GET `esummary.fcgi?db=pubmed&id=<comma-PMIDs>&retmode=json&...`.
   Sleep ≥350ms between chunks (3 req/sec ceiling without API key).
   On HTTP 429 back off 60s, retry once. Validate the JSON shape:
   ```bash
   python3 scripts/validators/validate_pubmed_esummary.py < /tmp/esummary.json
   ```
   Exit 0 → iterate records. Exit 1 → log the `missing_fields` array
   in the digest's Notes section; proceed only if the missing fields
   are non-critical (`pubtype` or `elocationid`). Exit 2 → upstream
   returned malformed JSON; back off 60s and retry once. Parse each
   record: `title`, `pubdate`, `authors[]`, `source` (journal),
   `pubtype[]`, `elocationid` (often a DOI).

4. **EFETCH abstracts and extract study facts.** GET
   `efetch.fcgi?db=pubmed&id=<comma-PMIDs>&rettype=abstract&retmode=xml`
   in the same 200-PMID chunks. Parse the XML for `<AbstractText>`
   blocks. From each abstract attempt to extract:
   - **Study design** — match against `pubtype[]` first (RCT,
     Meta-Analysis, Systematic Review, Observational Study, Case
     Report); fall back to abstract keyword match.
   - **Sample size** — regex `n\s*=\s*(\d[\d,]*)` and
     `(\d[\d,]+)\s+(patients|participants|subjects|adults)`.
   - **Effect size** — regex for `OR\s*=?\s*[\d.]+`, `HR\s*=?\s*[\d.]+`,
     `RR\s*=?\s*[\d.]+`, `p\s*[<=]\s*[\d.]+`, and confidence intervals
     `\(\s*95%?\s*CI[:\s]*[\d.\-,\s]+\)`.
   If the regex misses, record `unknown` for that field; do not invent
   numbers.

5. **Synthesize the digest.** Write
   `vault/wiki/research/healthcare-tech/<query-slug>.md` using the
   template in §"Digest template" below. Group studies by extracted
   `study_design`, with RCTs and meta-analyses first. Cite every
   record by PMID. Lead with a one-paragraph summary that mentions
   total study count, design mix, and the dominant finding direction
   if one is visible. Do not infer clinical recommendations.

## Inputs

- `query` (required, string). Free text describing the topic. Stage 1
  converts to PubMed syntax.
- `window_days` (optional, int). Date window. Default `365`.
- `max_results` (optional, int). PMID cap. Default `50`. Hard limit
  `200`.
- `study_types` (optional, list). Restrict to specific publication
  types (`rct`, `meta-analysis`, `systematic-review`, `observational`).
  Default: no restriction.
- `query_slug` (optional, string). Override the auto-generated slug.

## Outputs

- `vault/wiki/research/healthcare-tech/<query-slug>.md` — the digest.
  Idempotent: re-running on the same slug overwrites.

## Digest template

```md
---
domain: research/healthcare-tech
source: pubmed-digest
created: <YYYY-MM-DD>
updated: <YYYY-MM-DD>
tags: [<topic-keywords>]
---

# <Human title-case topic>

> Query: `<final PubMed query string>`
> Window: last <N> days · Results: <M> of <total> shown

## Summary

<One paragraph: total count, design mix, dominant finding direction
if visible. No clinical recommendations.>

## Randomized controlled trials

### <Paper title>
- PMID: <pmid> · DOI: <doi> · <journal>, <pubdate>
- Authors: <first author> et al. (<n_authors> total)
- Design: RCT · n=<sample size or unknown>
- Effect: <extracted effect size string or unknown>
- TL;DR: <one sentence drawn from the abstract>

## Meta-analyses and systematic reviews

...

## Observational studies

...

## Other

...

## Notes

<Capped at N of M total; extraction misses; any stage failures.>
```

## Examples

User: "pubmed search on GLP-1 agonists and cardiovascular outcomes,
last 2 years"

→ Stage 1: slug `glp1-cv-outcomes`. Query:
`("GLP-1 receptor agonists"[MeSH] OR "glp-1"[Title/Abstract]) AND
("cardiovascular diseases"[MeSH] OR "MACE"[Title/Abstract]) AND
humans[MeSH] AND english[Language] AND ("2024/05/13"[PDAT] :
"3000"[PDAT]) NOT "Retracted Publication"[Publication Type]`.
Stage 2: ESEARCH returns 87 PMIDs of 142 total. Stage 3: ESUMMARY
in one chunk (87 < 200). Stage 4: EFETCH abstracts; sample-size
regex hits on 71/87, effect-size regex hits on 49/87.
Stage 5: digest written to
`vault/wiki/research/healthcare-tech/glp1-cv-outcomes.md`. RCTs (12),
meta-analyses (4), observational (54), other (17). Summary
paragraph notes consistent CV benefit signal across RCTs.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| ESEARCH returns zero PMIDs | Query too restrictive or typo in MeSH | Drop filters one by one; check MeSH term in PubMed UI first |
| HTTP 429 on ESUMMARY | Burst over 3 req/sec | Back off 60s; consider obtaining an NCBI API key for 10/sec |
| ESUMMARY returns `error` field per PMID | PMID was deleted or merged | Skip that record; log in Notes |
| All extracted effect sizes are `unknown` | Regex too strict or abstracts structured oddly | Inspect 2-3 abstracts manually; loosen the regex in one stage-4 pass |
| `pubdate` parsing fails | Free-text dates (`2024 Spring`) | Treat as `<year>-01-01` if month unparseable; do not drop the record |
| Digest contains retracted papers | Filter not applied | Re-run with the `NOT "Retracted Publication"[Publication Type]` clause |
| Same paper listed twice | PubMed reindex caused PMID duplication | De-dupe by DOI when present; PMID otherwise |
