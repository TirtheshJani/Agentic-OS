---
name: regulatory-watch
description: Pull the latest FDA and CE healthcare-tech regulatory updates from public RSS feeds, classify by device class and topic, and write a watch report to vault/wiki/research/healthcare-tech/. Use when the user asks for "regulatory update", "FDA news", "new device clearances".
license: MIT
metadata:
  status: authored
  domain: research/healthcare-tech
  mode: remote
  mcp-server: none
  external-apis: [fda-rss, ce-rss]
  outputs: [vault/wiki/research/healthcare-tech/regulatory-YYYY-MM-DD.md]
---

# regulatory-watch

Orchestration pattern: **multi-MCP coordination**. Several independent
public feeds (FDA medical devices, FDA drugs, FDA recalls, MHRA drug
safety, MHRA device alerts, EMA news) fan into a single watch report.
Each feed is independently fail-soft: one feed timing out does not
block the others.

## References

- `references/feeds.md` (skill-local) — endpoint URLs for FDA, MHRA,
  EMA, device class taxonomy, and CE-marking caveats. Consult before
  any WebFetch call.
- `vault/CLAUDE.md` — wiki frontmatter shape and naming rules.

## Instructions

1. **Pin the window.** Default is the last 7 days ending today (UTC).
   Capture `window_start` and `window_end` for the report header.

2. **Fetch all feeds in parallel** using the `WebFetch` tool with the
   URLs from `references/feeds.md`:
   - FDA 510(k) medical device clearances
   - FDA drug approvals
   - FDA recalls / safety alerts
   - FDA MedWatch
   - MHRA drug safety updates (Atom)
   - MHRA medical device alerts (Atom)
   - EMA news (RSS)

   Each call returns XML. If a feed returns HTTP 4xx/5xx, capture the
   feed name + status and continue. Do not retry inside the loop;
   surface the failure in the "Coverage" section of the report.

3. **Parse each feed's items** into a uniform record:
   ```
   { feed: <feed_id>, title, link, published (ISO), summary }
   ```
   For RSS 2.0 use `channel/item/{title, link, pubDate, description}`.
   For Atom (MHRA) use `entry/{title, link[@href], updated, summary}`.
   Unescape HTML entities in `summary`/`description` once.

4. **Window-filter.** Drop items whose `published` is older than
   `window_start` or in the future (some feeds publish ahead of
   embargo dates). Sort ascending by `published`.

5. **Classify each surviving item** using **domain-specific
   intelligence** — embedded regulatory knowledge:
   - **Type:** `clearance` (510(k)), `approval` (PMA, NDA, BLA, EMA
     marketing auth, CHMP opinion), `recall`, `safety-alert`,
     `guidance` (FDA draft/final guidance docs), `other`.
     Heuristics: title contains "510(k)" → clearance; "Recalls" →
     recall; "FDA Approves" or "Marketing Authorization" → approval;
     "Safety Communication" / "Drug Safety Update" → safety-alert;
     "Guidance" → guidance.
   - **Device class** (only when type is `clearance` or `approval`
     and the item is a device, not a drug): Class I / II / III
     (FDA) or I / IIa / IIb / III (EU MDR). Pull from the linked
     page title if not in the RSS summary; if absent, mark
     `class: unknown`.
   - **Topic tag.** Match title + summary against the topic list:
     `ai-ml-saas`, `imaging`, `cardiology`, `oncology`, `diabetes`,
     `digital-therapeutics`, `wearable`, `genomics`, `surgical-robotics`,
     `drug-delivery`, `other`. Multi-tag allowed.

6. **Group and write.** Compose
   `vault/wiki/research/healthcare-tech/regulatory-<YYYY-MM-DD>.md`
   using the template in §"Report template". Group by `type`, then
   sort by `published` descending within each group. The
   AI/ML-as-SaMD bucket gets its own subsection (a long-standing user
   interest); include a count even when empty.

7. **Coverage block.** End the report with explicit coverage notes:
   which feeds succeeded, which failed, and the known CE-marking gap
   (no single EU feed exists; MHRA + EMA are the surrogate). Honesty
   about coverage matters more than apparent completeness.

## Inputs

- `window_days` (optional, int). Default `7`. Lookback window in
  days.
- `feeds` (optional, list). Subset of feed IDs from
  `references/feeds.md`. Default: all.
- `topics` (optional, list). Restrict the topic tag set. Default:
  all topics.
- `include_drugs` (optional, bool). Default `true`. Set `false` for a
  device-only watch.

## Outputs

- `vault/wiki/research/healthcare-tech/regulatory-<YYYY-MM-DD>.md` —
  the watch report. Date in the filename is the run date (window
  end), not any single item's date. Re-runs on the same date
  overwrite.

## Report template

```md
---
domain: research/healthcare-tech
source: regulatory-watch
created: <YYYY-MM-DD>
updated: <YYYY-MM-DD>
tags: [regulatory, <topic-tags>]
---

# Regulatory watch <YYYY-MM-DD>

> Window: <window_start> to <window_end> · Items: <N>

## AI/ML SaMD highlights

<Top 3 items tagged ai-ml-saas, full bullets. Empty section is fine;
write "No AI/ML SaMD items this window." if zero.>

## Clearances (FDA 510(k))

- <YYYY-MM-DD> · Class <I|II|III> · [<title>](<link>) · tags: <...>
  <one-line summary>

## Approvals (FDA / EMA / MHRA)

...

## Recalls and safety alerts

...

## Guidance documents

...

## Other

...

## Coverage

- FDA medical devices: <ok | error: status>
- FDA drugs: <...>
- FDA recalls: <...>
- FDA MedWatch: <...>
- MHRA drug safety: <...>
- MHRA device alerts: <...>
- EMA news: <...>
- CE marking: no single feed (see references/feeds.md). MHRA + EMA
  serve as the EU surrogate this report.
```

## Examples

User: "regulatory update"

→ Window 2026-05-06 to 2026-05-13. Seven feeds fetched in parallel.
EMA returns 502; the other six succeed. Total 38 items after window
filter. Classification: 12 clearances (Class II: 9, Class III: 2,
unknown: 1), 4 approvals, 8 recalls, 3 safety alerts, 5 guidance, 6
other. AI/ML SaMD bucket holds 3 items (two radiology triage tools
and a continuous-glucose-monitor algorithm update). Report written to
`vault/wiki/research/healthcare-tech/regulatory-2026-05-13.md`. The
Coverage block lists EMA as `error: 502`.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| WebFetch returns HTML, not XML | Feed URL redirected to a holding page | Verify URL against `references/feeds.md`; FDA occasionally moves feeds under reorgs |
| MHRA items missing `pubDate` | Atom uses `<updated>`, not `<pubDate>` | Parse Atom shape separately from RSS shape |
| Device class always `unknown` | RSS summary doesn't carry class info | Optionally follow the `link` once per item via WebFetch and parse the body; cap at 5 follows per run to stay polite |
| AI/ML SaMD section empty every run | Topic regex too strict | Widen `ai-ml-saas` match to include `artificial intelligence`, `machine learning`, `algorithm`, `software as a medical device`, `SaMD` |
| Same recall appears twice | FDA cross-posts to MedWatch and Recalls | De-dupe by `link` URL before grouping |
| All items dated yesterday | Feed served from a stale CDN cache | Append `?cb=<unix-ts>` to bust the cache and re-fetch |
| One feed failure blocks the run | Sequential fetch with no per-feed try/except | Use independent WebFetch calls; aggregate failures in the Coverage block |
