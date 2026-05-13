# Semantic Scholar

The Semantic Scholar Graph API powers paper metadata, citations,
references, and recommendations. No MCP server; HTTP only. This ref
is the central source of rate limits and tool selection for every
skill that touches Semantic Scholar (currently `paper-summary` and
`literature-review`).

Base URL: `https://api.semanticscholar.org/graph/v1`

## Auth scopes

No authentication required for the free tier. Pass `x-api-key` header
if you have a key; it raises the rate ceiling and gives priority on
shared infrastructure.

| Tier | Header | Sustained limit |
|---|---|---|
| Anonymous | none | ~100 req per 5 min per IP |
| Authenticated | `x-api-key: <key>` | ~1 req/sec sustained |

## Rate limits

The anonymous bucket is **shared across all endpoints per IP** —
batching paper detail calls quickly burns through it. 429 responses
come **without a `Retry-After` header**.

| Concern | Number |
|---|---|
| Anonymous bucket | ~100 / 5 minutes / IP |
| Authenticated | ~1 / second sustained |
| 429 recovery | Back off 30 seconds, retry once, then abort |

Skills should sequentialize batches of more than 5 requests and
budget ahead — a 200-paper literature review needs throttling at the
skill level, not after 429s start firing.

## Tool selection

| Endpoint | Use for |
|---|---|
| `GET /paper/{id}` | Bibliographic record for a single paper |
| `GET /paper/{id}/references` | What this paper cites |
| `GET /paper/{id}/citations` | What cites this paper |
| `GET /paper/{id}/recommendations` | Embedding-neighborhood papers |
| `GET /paper/search?query=...` | Title or keyword search |
| `POST /paper/batch` | Multiple paper details in one call (preferred for batches >3) |

`{id}` accepts multiple formats:
- arXiv: `arXiv:2401.12345`
- DOI: `DOI:10.1234/foo`
- Semantic Scholar paper ID: `<sha>`
- URL: `URL:<encoded-url>`
- PubMed: `PMID:<int>`

The prefix is required for non-Semantic-Scholar IDs.

Always pass `fields=...` — the default response returns `paperId`
only. Recommended set:

```
fields=title,abstract,authors,year,venue,externalIds,tldr,
       openAccessPdf,citationCount,referenceCount,fieldsOfStudy
```

For batches of 3+ papers prefer `POST /paper/batch` over N sequential
`GET /paper/{id}` calls.

## Common error decoding

| Status | Meaning | Action |
|---|---|---|
| 200 with null fields | Paper indexed but some fields unavailable | Treat missing as "unknown"; do not synthesize |
| 400 | Malformed ID (missing prefix is the usual cause) | Stop; fix the ID |
| 404 | Paper not indexed by Semantic Scholar | Treat as "not reachable"; consider arXiv direct |
| 429 | Rate limit | Back off 30s, retry once, then abort |
| 500 / 502 | Semantic Scholar backend transient | Retry with backoff, max 2 attempts |

## Common gotchas

- **The prefix is mandatory** on every non-Semantic-Scholar ID.
  `2401.12345` returns 404; `arXiv:2401.12345` returns the paper.
- **`tldr` is model-generated and frequently missing.** Don't
  synthesize one when the field is null — surface the gap instead.
- **`abstract` is often `null`** for closed-access papers.
  `openAccessPdf.url` may still be present pointing to a preprint.
- **No parsed full text.** Semantic Scholar exposes metadata and
  (when open access) a PDF URL. For body text fall back to the arXiv
  PDF (`http://arxiv.org/pdf/<id>`) when an arXiv ID is present.
- **`citationCount` lags reality** by weeks. Treat as approximate.
- **Search relevance is title-weighted.** A query that should match a
  body keyword may miss; widen the query or use `/paper/{id}/recommendations`
  on a known seed paper instead.
- **`externalIds` is a dict, not a list.** Keys are `DOI`, `ArXiv`,
  `PubMed`, `MAG`, `CorpusId`. Each may be missing independently.
