---
domain: productivity
source: promoted-from-raw
created: 2026-05-15
updated: 2026-05-15
tags: [inbox, gmail, triage, workflow, escalations]
---

# Inbox triage — emergent patterns

The `inbox-triage` skill has run twice (2026-05-14, 2026-05-15) and a
recurring shape is visible. This page documents the buckets, the volume,
and the heuristics that need tightening.

## The five-bucket schema

Every triage run produces the same sections, in this order:

1. **Reply now** — needs a draft today
2. **Reply later** — needs a reply, not today
3. **Read & file** — informational, keep for reference
4. **Archive** — transactional, no action
5. **Spam/Promo** — promotional bulk
6. **Escalations** — security-sensitive items that should not be dismissed
   without confirmation

Both runs so far had **zero** items in `Reply now` and `Reply later`. The
skill is currently optimized for the case where nothing is urgent.

## Volume baseline

| Date       | Total scanned | Read & file | Archive | Spam/Promo | Escalations |
|------------|---------------|-------------|---------|------------|-------------|
| 2026-05-14 | ~52           | 13          | 18      | 13         | 0           |
| 2026-05-15 | 47            | 17          | 7       | 22         | 1           |

Daily inbox volume is in the high-40s to low-50s. About a third is
transactional (job confirmations, receipts, shipping), a third is
promotional, the rest is informational reading.

## Recurring senders

Worth a filter or label rule:

- **Workable / Ashby / Recruitee / Teamtailor** — application
  acknowledgements. Always `Archive`. See
  [[business/ai-ml-job-application-pipeline]].
- **Remote Rocketship daily alerts** — `Read & file` when ≥1 new match,
  `Archive` when zero.
- **Skool, Eventbrite** — webinar / event reminders. `Read & file`.
- **GeopoliticsDaily (beehiiv)**, **The Good Trade** — newsletters,
  `Read & file`.
- **Netflix, Spotify, Best Buy, No Frills, Vessi, PC Optimum, Klarna,
  eBay** — promo, always `Spam/Promo`.
- **Patreon score uploads from `u76490808`** — sheet music drops; `Read
  & file`.

## Escalation example

2026-05-15 surfaced one escalation:

> thread:19e26aa7359ed607 · "Tirthesh, please verify your new device" ·
> `security-noreply@linkedin.com` — security flag: unexpected
> device-verification request; do not dismiss without confirming you
> initiated a new LinkedIn login.

The pattern: anything claiming "verify your device", "password changed",
or "unusual activity" from an account-bearing service gets escalated even
if it looks legit. Don't auto-archive security mail.

## Gaps / open follow-ups

- [ ] Both runs produced zero `Reply now` items. Confirm the heuristic is
  finding genuine replies rather than over-archiving recruiter follow-ups.
- [ ] No draft created on either day. If the goal is "draft for the human
  to review", a baseline of one draft per run is reasonable.
- [ ] Consider promoting recurring promotional senders (Vessi, Netflix,
  Best Buy) to an automatic `Spam/Promo` allowlist so they skip the LLM
  classification step entirely.

## Source raw notes

See also:

- [[raw/daily/2026-05-14-inbox-triage]]
- [[raw/daily/2026-05-15-inbox-triage]]
- [[raw/daily/2026-05-14-rollup]]
