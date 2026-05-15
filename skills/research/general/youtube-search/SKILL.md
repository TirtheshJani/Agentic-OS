---
name: youtube-search
description: Search YouTube for videos relevant to a topic, transcribe the top results via the youtube-transcript skill, and write a synthesized digest to vault/wiki/research/general/. Use when the user asks for "youtube research on X", "find videos about X", "summarize the top YouTube talks on X", or "what are people saying on YouTube about X". Scrape-based (no API key); results are best-effort.
license: MIT
allowed-tools: Bash, Read, Write, WebFetch
metadata:
  status: authored
  domain: research/general
  mode: remote
  mcp-server: none
  external-apis: [youtube]
  outputs: [vault/wiki/research/general/<topic-slug>-yt.md]
  depends-on: [youtube-transcript]
---

# youtube-search

Orchestration pattern: **sequential workflow orchestration**. Four ordered
phases — search → rank → transcribe top-N → synthesize. Each phase gates
the next; a hard failure in search aborts the run, partial failures during
transcription are reported in the digest's Notes section.

Implementation note: no YouTube Data API key is configured, so search is
performed by scraping `https://www.youtube.com/results?search_query=...`
via WebFetch (or Firecrawl if present). The YouTube results page is a
JS-rendered SPA but ships an inlined `ytInitialData` JSON blob in the HTML
that contains video IDs, titles, channel names, view counts, and ages —
sufficient to rank candidates without an API key. The shape of this blob
is not contractual; treat extraction failures as expected and degrade
gracefully (see Troubleshooting).

## References

- `skills/research/youtube-transcript/SKILL.md` — sister skill that owns
  transcript fetching (yt-dlp + Whisper fallback). This skill calls into
  it; do not duplicate its logic.
- `skills/research/article-extractor/SKILL.md` — same scrape-then-clean
  pattern used here for the results page.

## Instructions

1. **Slugify the topic.** Lower-case, replace non-alphanumerics with `-`,
   collapse repeats, trim leading/trailing `-`. Cap at 60 chars. This is
   `<topic-slug>` for the output path and the search-query encoding base.

2. **Search.** Fetch the YouTube results page:
   ```
   https://www.youtube.com/results?search_query=<url-encoded topic>&sp=CAMSAhAB
   ```
   The `sp=CAMSAhAB` filter biases toward recent uploads sorted by view
   count; drop it if `recency_days` is large or unspecified and the user
   wants all-time top hits. Use WebFetch. If WebFetch returns a rendered
   summary instead of raw HTML, retry with `curl -A "Mozilla/5.0 ..."`
   via Bash and parse the response body directly.

3. **Extract candidates from `ytInitialData`.** The HTML contains a line
   that looks like `var ytInitialData = { ... };`. Slice out the JSON,
   walk `contents.twoColumnSearchResultsRenderer.primaryContents.
   sectionListRenderer.contents[*].itemSectionRenderer.contents[*].
   videoRenderer`, and collect for each entry:
   - `videoId`
   - `title.runs[0].text`
   - `ownerText.runs[0].text` (channel)
   - `viewCountText.simpleText` (parse to int; "1.2M" → 1_200_000)
   - `publishedTimeText.simpleText` ("3 weeks ago" → approx day count)
   - `lengthText.simpleText` (skip Shorts: anything under 60s)
   Construct `url = https://www.youtube.com/watch?v=<videoId>`.

4. **Rank and filter.** Drop entries older than `recency_days` (default
   365). Drop Shorts. Sort by `views / max(age_days, 1)` (a crude
   views-per-day proxy that prefers durable hits over flash-in-pan).
   Take the top `top_n` (default 5).

5. **Transcribe top-N.** For each surviving URL, invoke the
   `youtube-transcript` skill. Operationally this means running the
   yt-dlp pipeline documented in
   `skills/research/youtube-transcript/SKILL.md`:
   ```bash
   yt-dlp --write-auto-sub --skip-download --sub-langs en \
     --output "/tmp/yt-<videoId>" "<url>"
   ```
   then deduplicating the VTT to plain text (see that skill's
   post-processing block). Do NOT invoke the Whisper fallback in this
   skill — if captions are unavailable, mark the video as
   "transcript unavailable" in Notes and continue. Whisper requires user
   confirmation per the sister skill's contract; running it across N
   videos in a research scan would violate that contract.

6. **Synthesize the digest.** For each transcribed video, produce a
   2–4 sentence summary grounded in the transcript text (not the title).
   Cite specific claims with `(MM:SS)` timestamps when the VTT preserves
   them; otherwise just summarize. Compose the digest in this order:
   ```
   # <Topic> — YouTube digest (YYYY-MM-DD)

   Searched YouTube for "<topic>"; reviewed top N of M results by
   views-per-day over the last <recency_days> days.

   ## Key themes
   - 3–6 bullets synthesizing across videos

   ## Videos
   ### 1. <Title> — <Channel>
   - URL: https://www.youtube.com/watch?v=<id>
   - <views> views · <age> · <length>
   - Summary: <2–4 sentences>

   ### 2. ...

   ## Notes
   - Videos skipped (no transcript, Shorts, off-topic): ...
   - Search method: scraped YouTube results page (no API key)
   ```

7. **Write** to `vault/wiki/research/general/<topic-slug>-yt.md`.
   Idempotent — re-running on the same topic overwrites the file.

## Inputs

- `topic` (required, string). Free-text query.
- `top_n` (optional, int). Number of videos to transcribe and summarize.
  Default: `5`.
- `recency_days` (optional, int). Max age of videos to consider.
  Default: `365`. Set to a large number (e.g. `36500`) for all-time.

## Outputs

- `vault/wiki/research/general/<topic-slug>-yt.md`

## Examples

User: "youtube research on small language models"

→ Slug: `small-language-models`. Search URL hits, `ytInitialData` parses,
12 candidates extracted, 2 Shorts dropped, 1 older than 365 days dropped.
Top 5 by views-per-day go to youtube-transcript. 4 return auto-sub
transcripts; 1 has captions disabled and is listed in Notes. Digest
written to `vault/wiki/research/general/small-language-models-yt.md`
with key themes (distillation, on-device inference, MoE-vs-dense
tradeoffs) and 5 per-video entries.

User: "find videos about rust async runtimes from the last 90 days, top 3"

→ `topic="rust async runtimes"`, `top_n=3`, `recency_days=90`.
Slug: `rust-async-runtimes`. Output:
`vault/wiki/research/general/rust-async-runtimes-yt.md`.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| WebFetch returns a summary, not HTML | Tool fetched and summarized | Re-fetch via `curl -A "Mozilla/5.0"`; parse raw body |
| `ytInitialData` block not found | YouTube changed page shape | Fall back to regex extraction of `"videoId":"([A-Za-z0-9_-]{11})"` plus `"title":{"runs":[{"text":"..."}]}`; if that also fails, abort with a clear error |
| All view counts come back as "No views" | New uploads with no traffic | Treat as `views=0`; they sort to the bottom under views-per-day, which is the desired behavior |
| Every video reports "transcript unavailable" | Captions disabled across the board, or yt-dlp rate-limited | Re-run with `--cookies-from-browser` per yt-dlp docs; do NOT auto-invoke Whisper |
| Results dominated by clickbait / unrelated channels | Scrape ranking is crude | Tighten the query (add quotes, add domain terms); raise `recency_days` floor; consider adding a per-channel block list in a future iteration |
| Region-locked or age-gated video | yt-dlp will error per-video | Skip and list in Notes; do not retry blindly |
| Output already exists | Re-run on same topic | Overwrite — digest is idempotent by design |
