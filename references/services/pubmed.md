# PubMed (NCBI E-utilities)

NCBI E-utilities are the canonical API for PubMed search and
retrieval. No MCP server; HTTP only. This ref is the central source
of rate limits, auth gotchas, and tool selection for every skill
that touches PubMed (currently `pubmed-digest` and
`literature-review`).

## Endpoints

```
ESEARCH  https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi
ESUMMARY https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi
EFETCH   https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi
```

All accept `db=pubmed`. ESEARCH returns PMIDs; ESUMMARY returns
metadata; EFETCH returns full XML including abstracts when
`rettype=abstract&retmode=xml`.

## Auth scopes

No authentication required for read access. Skills SHOULD set the
NCBI-mandated identification parameters on every request:

```
tool=agentic-os
email=tirtheshjani@gmail.com
```

Providing `api_key=<key>` raises the per-IP rate ceiling but is not
required.

## Rate limits

| Mode | Limit |
|---|---|
| Without API key | 3 requests/second per source IP |
| With `api_key=<key>` | 10 requests/second per key |
| Burst above cap | HTTP 429 |
| 429 recovery | Back off 60 seconds, retry once |

NCBI publishes these numbers and enforces them strictly. A skill that
parallelizes esearch + esummary calls must serialize them per-source.

## Tool selection

The two-call flow is the default:

1. **ESEARCH** with `term=<query>&retmax=50&sort=date&retmode=json`.
   Parse `esearchresult.idlist` → list of PMIDs.
2. **ESUMMARY** with `id=<comma-separated PMIDs>&retmode=json`. Parse
   `result.<pmid>` records. Each carries `title`, `pubdate`,
   `authors[]`, `source` (journal), `pubtype[]`, `epubdate`,
   `elocationid`.

EFETCH is only needed when ESUMMARY isn't enough:

- Abstract bodies for evidence digests:
  `id=<pmids>&rettype=abstract&retmode=xml`
- MeSH terms not in ESUMMARY: same EFETCH call

Prefer chunking large PMID lists into batches of ≤200 over ESUMMARY's
soft cap.

## Query construction

PubMed query syntax uses field tags in `[brackets]`:

```
diabetes[MeSH] AND glp-1[Title/Abstract]
("2024/01/01"[PDAT] : "3000"[PDAT])
randomized controlled trial[Publication Type]
last 90 days[edat]
```

Combine with `AND` / `OR` / `NOT`. URL-encode the full query.

Useful filters for an evidence digest:
- `Randomized Controlled Trial[Publication Type]`
- `Meta-Analysis[Publication Type]`
- `Systematic Review[Publication Type]`
- `humans[MeSH Terms]`
- `english[Language]`

## Common error decoding

| Status | Meaning | Action |
|---|---|---|
| 200 with empty `idlist` | Query returned no results | Surface to user; not an error |
| 400 | Malformed query (often unbalanced brackets or unescaped operators) | Stop; fix the query |
| 414 | URI too long (PMID list overran the GET limit) | Switch to POST or chunk smaller |
| 429 | Rate limit | Back off 60s, retry once |
| 500 / 502 | NCBI backend transient | Retry with backoff, max 3 attempts |

## Common gotchas

- **PMIDs are strings, not ints**, when `retmode=json`. Don't cast.
- **ESUMMARY truncates around 200 IDs per call.** Chunk if you need more.
- **`pubdate` is free text** (`2024 Mar 15`, `2024 Spring`, `2024`).
  Parse loosely; don't assume ISO format.
- **Effect sizes and sample sizes are not in ESUMMARY.** Pull from
  the abstract via EFETCH and regex-extract (`n=<int>`, `OR <float>`,
  `HR <float>`, `RR <float>`, `[95% CI ...]`, `p<\d`).
- **Retracted papers are returned by default.** Filter
  `Retracted Publication[Publication Type]` out unless intentionally
  surfacing retractions.
- **Date filter `[edat]` is entry date** (when the record entered
  PubMed), not the publication date `[PDAT]`. They differ by weeks.
- **The XML returned by EFETCH is not stable across articles** — some
  records have a structured abstract (Background / Methods / Results
  / Conclusions), others a single block. Handle both.
