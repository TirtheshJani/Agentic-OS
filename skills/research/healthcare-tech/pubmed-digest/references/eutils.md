# PubMed E-utilities cheatsheet

NCBI E-utilities power PubMed search. No MCP server; HTTP only.

## Endpoints

```
ESEARCH  https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi
ESUMMARY https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi
EFETCH   https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi
```

All accept `db=pubmed`. ESEARCH returns PMIDs; ESUMMARY returns
metadata; EFETCH returns full XML (with abstracts when `rettype=abstract
retmode=xml`).

## Auth and rate limits

- Without API key: **3 requests/sec** per source IP.
- With `api_key=<key>` query param: **10 requests/sec**.
- Bursts above the cap return HTTP 429. Back off 1 minute and retry.
- Always set `tool=agentic-os` and `email=tirtheshjani@gmail.com` per
  NCBI policy.

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

## Typical two-call flow

1. ESEARCH with `term=<query>&retmax=50&sort=date&retmode=json`. Parse
   `esearchresult.idlist` → list of PMIDs.
2. ESUMMARY with `id=<comma-separated PMIDs>&retmode=json`. Parse
   `result.<pmid>` records. Each carries `title`, `pubdate`,
   `authors[]`, `source` (journal), `pubtype[]`, `epubdate`, `elocationid`.
3. (Optional) EFETCH for abstracts when ESUMMARY is not enough:
   `id=<pmids>&rettype=abstract&retmode=xml`.

## Common gotchas

- ESEARCH `retmode=json` returns PMIDs as strings, not ints.
- ESUMMARY truncates at ~200 IDs per call. Chunk if needed.
- `pubdate` is free text (`2024 Mar 15`, `2024 Spring`); parse loosely.
- Effect sizes and sample sizes are NOT in ESUMMARY. Pull from the
  abstract via EFETCH and regex (`n=<int>`, `OR <float>`, etc).
- Publication types include retracted papers; filter
  `Retracted Publication` out unless intentionally surfacing.
