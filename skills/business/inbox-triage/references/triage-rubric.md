# Inbox triage rubric

Used by the `inbox-triage` skill.

## Buckets

| Bucket | Criteria | Action |
|---|---|---|
| **Reply now** | Direct ask + sender is colleague/customer + can answer in <5 min | Draft reply |
| **Reply later** | Direct ask + can answer with batched context | Add to `vault/wiki/business/inbox-followup.md` |
| **Read & file** | Newsletter, FYI, or async update worth keeping | Save snippet to `vault/raw/` |
| **Archive** | Receipts, notifications, automated mail | Archive in Gmail |
| **Spam/Promo** | Marketing or low-signal | Mark as spam if egregious; otherwise archive |

## Reply drafting rules

- Match the sender's tone (formal vs. casual).
- Confirm the ask in one line before answering.
- If unsure, draft a clarifying question rather than a guess.
- Sign off consistently (use the user's standard sign-off if known).

## Escalation
- Anything from a name on the user's "VIP" list goes to **Reply now**
  regardless of complexity.
- Anything threatening/legal/security-flagged: surface to user; do not
  auto-draft.
