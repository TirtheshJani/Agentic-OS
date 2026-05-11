---
name: inbox-triage
description: Triage the user's Gmail inbox using the rubric in references/triage-rubric.md, surface buckets for a single sweep, draft replies only for the Reply-now bucket, and write a thread-ID-only report. Never auto-archive or auto-label. Use when the user asks to "triage my inbox", "clear inbox", "what needs a reply".
license: MIT
metadata:
  status: authored
  domain: business
  mode: remote
  mcp-server: gmail
  external-apis: [none]
  outputs: [vault/raw/daily/<YYYY-MM-DD>-inbox-triage.md]
---

# inbox-triage

Orchestration pattern: **multi-MCP coordination + domain-specific
intelligence**. The "intelligence" is the rubric — a fixed, named set
of buckets and a Reply-Now policy. The skill never auto-archives or
auto-labels; it surfaces buckets so the user sweeps in one pass.

## References

- `references/services/gmail.md` — auth scopes, the **privacy rule**
  (thread bodies never leave the vault), query syntax, gotchas.
- `references/triage-rubric.md` (skill-local) — bucket definitions,
  reply drafting rules, escalation.
- `scripts/validators/check_rubric_coverage.py` — confirm every
  bucket is present in the final report and no bodies leaked.

## Instructions

1. **Pull unread.** `search_threads` with `is:unread newer_than:1d
   -category:promotions -category:social` for actionable. Run a
   second `search_threads` for `category:promotions OR
   category:social newer_than:1d` to populate Spam/Promo without
   re-reading them.
2. **Classify each thread** by the rubric in
   `references/triage-rubric.md`. Use snippet text only — never call
   `get_thread` to fetch the body unless drafting (step 3). VIP-list
   senders go to Reply now regardless of complexity.
3. **Draft Reply-now replies.** For each Reply-now thread:
   - `get_thread` to load the body.
   - `create_draft` with a reply that confirms the ask in one line
     before answering. Sign off consistently. If unsure, draft a
     clarifying question instead of a guess.
   - Drafts never auto-send. They sit in Drafts for the user.
4. **Compose the report** at
   `vault/raw/daily/<YYYY-MM-DD>-inbox-triage.md` with this exact
   structure:
   ```md
   # Inbox triage YYYY-MM-DD

   ## Reply now
   - thread:<id> · <subject> · <sender>
   ## Reply later
   ## Read & file
   ## Archive
   ## Spam/Promo
   ## Escalations
   ```
   Every entry: `thread:<id>` first. Then subject + sender. **No
   body content.** Snippets are also bodies — do not include them.
5. **Validate** the report:
   ```bash
   python3 scripts/validators/check_rubric_coverage.py < vault/raw/daily/<file>.md
   ```
   Exit 0 → done. Exit 1 → fix the missing bucket or suspicious
   lines. Threats/legal items always surface in the response **and**
   the Escalations section; do not draft for them.
6. **Surface in response:** counts per bucket, count of drafts
   created, escalation list. **No body text in the response either.**
   See `references/services/gmail.md` privacy rule.

## Inputs

- `window` (optional, Gmail query fragment). Default: `newer_than:1d`.
- `vip` (optional, list of email addresses). Always Reply now.

## Outputs

- `vault/raw/daily/<YYYY-MM-DD>-inbox-triage.md`
- Gmail drafts under the user's account (Reply-now bucket only).

## Examples

User: "triage my inbox"

→ Skill finds 23 unread in the last day. Classifies: 4 Reply now, 7
Reply later, 5 Read & file, 4 Archive, 3 Spam/Promo. One thread from
a customer flagged as legal-adjacent → Escalations + Reply now is
**not** drafted. Three drafts created for the remaining Reply-now.
Writes report. Validator passes.

Response:

> Triaged 23 threads. Reply now: 4 (3 drafted, 1 escalated). Reply
> later: 7. Read & file: 5. Archive: 4. Spam/Promo: 3.
> Escalations: 1 — thread:abc12345 (legal-adjacent). Report:
> `vault/raw/daily/2026-05-11-inbox-triage.md`.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Validator reports "suspicious_body_lines" | A snippet or quote leaked into the report | Re-render with thread IDs + subject + sender only |
| Validator reports missing bucket | One category had zero threads | Include the empty header with "none" — completeness > brevity |
| Draft created on a Reply-later thread | Classification error | Manually delete the draft in Gmail; tighten the rubric for that sender pattern |
| 250 quota units/sec exceeded | Tight `get_thread` loop | Batch all classification from snippets first; only call `get_thread` for Reply-now |
| Same thread appears in two buckets | Multiple matches in the rubric | Apply rubric rows top-to-bottom, first match wins |
