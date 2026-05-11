# arXiv

arXiv's public Atom API powers every paper-discovery skill in this
repo. No MCP server — skills call the HTTP endpoint directly.

## Endpoint

```
https://export.arxiv.org/api/query?search_query=...&start=0&max_results=50
```

Atom 1.0 response. Each `<entry>` carries `id`, `published`,
`updated`, `title`, `summary`, `author/name`, and one or more
`<category term="..."/>` tags.

## Auth scopes

None. arXiv API is fully public.

## Rate limits

- **One request every three seconds.** The TOS asks for this; ignoring
  it gets the source IP soft-blocked for ~minutes at a time.
- **Burst:** four requests per second sustained will trip the block.
- Skills that page through results should sleep ≥3s between pages.

There are no rate-limit headers. The only signal is HTTP 503 plus an
HTML body explaining the block. Treat 503 as "back off for 60s, then
retry once" — not as a regular failure.

## Query construction

Three useful query forms:

```
# Single category, today's submissions
cat:cs.LG AND submittedDate:[YYYYMMDD0000 TO YYYYMMDD2359]

# Multiple categories, OR'd
(cat:cs.LG OR cat:stat.ML OR cat:cs.AI)

# All-fields keyword search
all:"diffusion model"
```

`submittedDate` is in the local arXiv submission window (US Eastern).
A run against "today" before ~09:00 UTC may return no results because
arXiv hasn't published the day's batch yet. Fall back to the previous
UTC day in that case.

## Tool selection

- For **today's new submissions** in a fixed set of categories →
  `cat:X AND submittedDate:[...]` with a 1-day window.
- For **a keyword search across history** → `all:"keyword"`.
- For **a specific paper by arXiv ID** → `id_list=2401.12345` (no
  `search_query` parameter).

## Common gotchas

- **Atom IDs are URLs**, not bare arXiv IDs:
  `http://arxiv.org/abs/2401.12345v1`. Extract the trailing path
  segment to get the ID, and strip the `vN` suffix to get the
  version-independent ID.
- **`<summary>` is the abstract**, not a search snippet. Whitespace is
  preserved (line breaks from the source LaTeX leak through).
- **Multiple `<author>` entries** — Atom permits N children. Don't
  assume the first is the corresponding author; that information is
  not in the API.
- **Category cross-listing.** A paper may appear in `cs.LG` and
  `stat.ML` and `cs.AI`. The "primary" category is the first
  `<arxiv:primary_category>` element. De-dupe by ID, not by category.
- **No author affiliations** in the API. The Atom feed does not include
  them; pull from the PDF or skip.
- **Schema is stable.** It hasn't materially changed since 2013. The
  `validate_arxiv_atom.py` script in `scripts/validators/` checks
  shape; failures usually mean the API returned an error HTML page
  instead of XML.
