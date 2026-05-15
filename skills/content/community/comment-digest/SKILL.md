---
name: comment-digest
description: Pull recent Substack/community comments from Gmail, group by post, summarize sentiment, and surface comments that warrant a personal reply. Use when the user asks for "comment digest", "recent comments", "who replied this week".
license: MIT
metadata:
  status: authored
  domain: content/community
  mode: remote
  mcp-server: gmail
  external-apis: [none]
  outputs: [vault/wiki/content/community/comments-YYYY-MM-DD.md]
---

# comment-digest

Orchestration pattern: **sequential workflow orchestration**. Five ordered
phases against a single MCP (Gmail): pin window → search → group by post →
score reply-worthiness → write digest. Each phase gates the next; if Gmail
search returns zero threads the digest still gets written (empty-state
section) so downstream automations can rely on the file existing.

## References

- `../../../../references/services/gmail.md` — **read first**. Privacy rule
  is non-negotiable: vault output references threads by subject + sender +
  thread ID only, never body content. Snippets (~200 char preview) are
  acceptable signal for scoring but must not be quoted in the digest.
- Substack comment notifications: `from:no-reply@substack.com` with
  subject pattern `New comment on "<post title>"`. Reply notifications use
  `New reply to your comment on "<post title>"`.
- Self-hosted / other community platforms (Discourse, Ghost, Buttondown)
  follow the same pattern but vary in sender. Defaults below cover
  Substack; the `senders` input lets the user extend.

## Instructions

1. **Pin the window.** Compute `today` in user TZ. Default lookback is
   7 days. Translate to Gmail's relative operator: `newer_than:7d`. If the
   user asks for a different window (e.g. "this week", "since Monday"),
   convert to `newer_than:Nd` — Gmail does not accept ISO dates for
   `newer_than`.

2. **Search Gmail for comment notifications.** Use `search_threads` with:

   ```
   from:no-reply@substack.com subject:"New comment on" newer_than:7d
   ```

   If `senders` input is provided, OR them into the query:

   ```
   { from:no-reply@substack.com OR from:notifications@discourse.example.com } newer_than:7d
   ```

   Cap results at 200 threads; if the response indicates more, note in the
   digest "Notes" section that the window was saturated and recommend a
   shorter window.

3. **Extract per-thread metadata only.** For each thread in the result,
   keep:
   - `thread_id`
   - `subject` (full, untruncated)
   - `sender`
   - `snippet` (Gmail's ~200-char preview — used for scoring, **not
     persisted to the digest**)
   - `internal_date` (for ordering)

   Do **not** call `get_thread` to fetch bodies. Search snippets are
   sufficient for the signals below and stay inside the privacy rule's
   acceptable-output set (metadata + truncated preview is fine for
   scoring; the digest itself records only metadata).

4. **Parse the post title out of the subject.** Substack format is
   `New comment on "Post Title Here"`. Regex:
   `^New (?:comment|reply) on "(?P<title>.+)"$`. Threads that don't
   match get bucketed under `Unparsed` and surfaced in Notes.

5. **Group by post.** Build a map `post_title -> [thread metadata...]`.
   Sort posts by thread count descending; within each post sort threads
   by `internal_date` descending (newest first).

6. **Score reply-worthiness** per thread. This is a heuristic ranking,
   not a quote. For each thread, compute a small integer score using
   only the snippet preview and sender:

   | Signal | Points | Detection |
   |---|---|---|
   | Snippet contains `?` | +2 | Question mark in the ~200-char preview |
   | Snippet length ≥ 180 chars | +1 | Likely a substantive comment (Gmail truncates around 200) |
   | Sender appears in 2+ threads this window | +2 | Repeat commenter — count occurrences of the From address across all search results |
   | Reply notification (not original comment) | +1 | Subject starts `New reply to your comment on` — direct conversation |
   | Snippet starts with greeting (`Hi`, `Hey`, `Thanks`) | +1 | Addresses author directly |

   Threads with score ≥ 3 land in the **Worth a personal reply** section.
   Threads with score 1–2 land under their post in the **By post** section.
   Threads with score 0 are counted but not individually listed (to keep
   the digest skimmable); they roll up into a "+N other comments" line per
   post.

7. **Aggregate sentiment.** Without quoting bodies, derive coarse
   sentiment counts per post from the snippet preview using simple
   keyword heuristics:

   - Positive markers: `thanks`, `great`, `love`, `helpful`, `excellent`,
     `awesome`, `appreciate`.
   - Critical markers: `disagree`, `wrong`, `but`, `however`, `confused`,
     `unclear`.
   - Question markers: contains `?`.

   Report only **aggregate counts** per post (e.g. "5 positive · 2
   question · 1 critical"). Do not list which thread fell in which
   bucket; the reply-worthiness section already surfaces the specific
   threads that need attention. This satisfies the privacy rule — the
   digest contains counts and IDs, no commenter text.

8. **Compose the digest.** Sections in this order:

   ```
   # YYYY-MM-DD comment digest

   ## Summary
   - <N> comments across <M> posts (window: last 7d)
   - <K> threads warrant a personal reply

   ## Worth a personal reply
   <list, sorted by score desc; one line per thread>

   ## By post
   <one ### block per post, sorted by comment count desc>

   ## Notes
   <window saturation, unparsed subjects, MCP errors, etc.>
   ```

   Line format in **Worth a personal reply** (metadata only):

   ```
   - score 4 · "<post title>" · <sender> · thread `<thread_id>`
   ```

   Per-post block in **By post**:

   ```
   ### <post title>
   - <total> comments · sentiment: <P positive · Q question · C critical>
   - <newest commenter> · thread `<thread_id>`
   - <next commenter>   · thread `<thread_id>`
   - +<N> other comments
   ```

9. **Write** to `vault/wiki/content/community/comments-<YYYY-MM-DD>.md`.
   Idempotent: re-running on the same day overwrites the file. Create the
   parent directory if it does not exist.

10. **Final assistant message** must follow the Gmail privacy rule for
    the dashboard preview: report counts, the output path, and the
    number of reply-worthy threads. Do not include subjects, senders,
    or snippets in the chat output — they live in the vault file only.

## Inputs

- `window_days` (optional, int). Default: `7`. Translated to
  `newer_than:Nd` in the Gmail query.
- `senders` (optional, list of email addresses). Default:
  `["no-reply@substack.com"]`. OR-ed into the Gmail `from:` clause.
- `reply_score_threshold` (optional, int). Default: `3`. Minimum score
  for the "Worth a personal reply" section.

## Outputs

- `vault/wiki/content/community/comments-<YYYY-MM-DD>.md`

## Examples

User: "comment digest"

→ Window: last 7d. Gmail search returns 23 threads from
`no-reply@substack.com`. Parsing pulls 4 distinct post titles. Three
threads score ≥ 3 (two contain `?`, one is from a commenter who appears
in 4 threads). Digest written:

```md
# 2026-05-15 comment digest

## Summary
- 23 comments across 4 posts (window: last 7d)
- 3 threads warrant a personal reply

## Worth a personal reply
- score 5 · "Why I left FAANG" · reader-a@example.com · thread `18f4a2b1c`
- score 4 · "Why I left FAANG" · reader-b@example.com · thread `18f4a31d2`
- score 3 · "Notes on agentic OS" · reader-c@example.com · thread `18f49e0aa`

## By post
### Why I left FAANG
- 11 comments · sentiment: 7 positive · 3 question · 1 critical
- reader-a@example.com · thread `18f4a2b1c`
- reader-b@example.com · thread `18f4a31d2`
- +9 other comments

### Notes on agentic OS
- 8 comments · sentiment: 5 positive · 2 question · 0 critical
- reader-c@example.com · thread `18f49e0aa`
- +7 other comments

### Weekly links #12
- 3 comments · sentiment: 3 positive · 0 question · 0 critical
- +3 other comments

### Reader Q&A
- 1 comment · sentiment: 0 positive · 1 question · 0 critical
- reader-d@example.com · thread `18f4881ff`

## Notes
- All 23 subjects parsed cleanly.
```

Final assistant chat message:

> Comment digest written to
> `vault/wiki/content/community/comments-2026-05-15.md`. 23 comments
> across 4 posts in the last 7 days; 3 threads warrant a personal reply.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Zero threads returned | Substack moved off `no-reply@substack.com`, or window too short | Try `from:substack.com` (broader); confirm in Gmail UI; widen `window_days` |
| All subjects land in `Unparsed` | Substack subject template changed | Inspect 2-3 raw subjects in Gmail UI, update the regex in step 4, do not commit any inspected text |
| Same sender flagged "repeat" but it's the platform itself | Counted `no-reply@…` instead of commenter | The "From" on a Substack notification is the platform; if available, use the `Reply-To` header or pull commenter from snippet preamble. If neither is reliable, drop the repeat-commenter signal and note in Notes |
| Snippet preview contains body text — am I violating privacy? | Snippets are metadata from Gmail's API, fine for in-process scoring; the **persisted digest** must not contain them | Score using snippet; write only counts + IDs to the file |
| Window saturated (200+ threads) | High-volume post drove an outlier week | Note in `Notes`, recommend re-running with `window_days: 3` |
| Gmail rate limit (429) | Bursting many `search_threads` calls | A single search with OR-ed `from:` clauses replaces N calls; if already a single call, back off 5s and retry once |
