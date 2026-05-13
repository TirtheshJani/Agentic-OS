# Semantic Scholar API tips

Graph API base: `https://api.semanticscholar.org/graph/v1`. No auth
required for the free tier; pass `x-api-key` if you have a key.

## Rate limits

- Unauthenticated: ~100 requests per 5 minutes per IP, shared across
  endpoints. Spread calls; sequentialize batches of more than 5.
- Authenticated (`x-api-key`): documented ~1 request/second sustained.
- 429 responses come without a `Retry-After`. Back off 30s and retry
  once; do not loop.

## Useful endpoints

- `GET /paper/{id}` — bibliographic record. `id` accepts arXiv
  (`arXiv:2401.12345`), DOI (`DOI:10.1234/foo`), Semantic Scholar
  (`<sha>`), or `URL:<url>`. Always pass `fields=...` (default returns
  only paperId).
- `GET /paper/{id}/references` — works cited by this paper.
- `GET /paper/{id}/citations` — papers citing this one.
- `GET /paper/{id}/recommendations` — neighborhood by embedding.
- `GET /paper/search?query=...&fields=...` — title search.

Useful `fields` set: `title,abstract,authors,year,venue,
externalIds,tldr,openAccessPdf,citationCount,referenceCount,fieldsOfStudy`.

## Common errors

- `404 Paper not found` — wrong prefix on the ID (missing `arXiv:` or
  `DOI:`). Re-check the prefix.
- `429` — see rate limits. Single retry after 30s, then abort.
- Empty `abstract` and no `openAccessPdf.url` — paper is closed-access
  or the index is missing the body. Fall back to the arXiv Atom API
  if an arXiv ID is available, otherwise summarize from the abstract
  alone and note the gap.
- `tldr` missing — the TLDR model didn't cover this paper. Skip the
  TLDR field; do not synthesize one.

## Full-text caveat

Semantic Scholar exposes metadata and (when open access) a PDF URL.
It does not provide parsed full text. For full text, fetch the arXiv
PDF (`http://arxiv.org/pdf/<id>`) directly when an arXiv ID is
present.
