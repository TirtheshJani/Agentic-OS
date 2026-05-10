---
name: inbox-triage
description: Triage the user's Gmail inbox using the rubric in references/triage-rubric.md, draft replies for items needing immediate response, and write a triage report. Use when the user asks to "triage my inbox", "clear inbox", "what needs a reply", "what's urgent in email".
license: MIT
metadata:
  status: authored
  domain: business
  mode: remote
  mcp-server: gmail
  external-apis: [none]
  outputs:
    - vault/wiki/business/inbox-YYYY-MM-DD.md
    - Gmail drafts (Reply now bucket only)
---

# inbox-triage

Categorize unread / recent threads, draft responses for the urgent
bucket only, and write a single report so the user can clear inbox in
one pass instead of context-switching per message.

**Orchestration pattern:** multi-MCP coordination + domain-specific
intelligence. The classification logic is rubric-driven (consult
`references/triage-rubric.md` *before* acting on any thread); the
draft step uses the Gmail MCP.

The rubric is authoritative. If you find yourself wanting to deviate,
update the rubric — don't override it inline.

## Instructions

1. **Read the rubric first.** Open
   `references/triage-rubric.md` and load the bucket criteria,
   reply-drafting rules, and escalation list into context. Without
   this the classifications will be inconsistent across runs.

2. **Pull threads.** Call
   `mcp__a6c76000-...__search_threads` with a query like
   `in:inbox is:unread newer_than:<since>` (default `since=2d`). Cap
   at `max_threads` (default 50). For each thread, call
   `get_thread` to read the body and metadata.

3. **Classify each thread** into one of the rubric buckets: Reply
   now, Reply later, Read & file, Archive, Spam/Promo. Apply the
   escalation rule: anything from a name on the user's VIP list
   (`references/triage-rubric.md` "Escalation") goes to Reply now
   regardless of complexity.

4. **Draft replies for "Reply now" only.** For each Reply-now thread,
   call `mcp__a6c76000-...__create_draft` following the rubric's
   reply-drafting rules. Match sender tone, confirm the ask in one
   line, sign off consistently. Save as a draft — never send.

5. **Do not auto-act for the other buckets.** Do not archive, label,
   or modify "Read & file" / "Archive" / "Spam/Promo" threads. The
   triage report lists them so the user can sweep manually in one
   pass; auto-acting risks losing context.

6. **Write the report** to
   `vault/wiki/business/inbox-<today>.md` with the structure under
   Outputs. Include subject, sender, one-line summary, and the bucket
   per thread. For Reply-now items, include the draft id (Gmail
   surfaces it as a `messageId` of the draft) so the user can find it
   in Gmail's drafts list.

7. **Surface anything threatening / legal / security-flagged**
   directly in the response, not just in the report. Don't
   auto-draft.

## Inputs

| Input | Default | Notes |
|---|---|---|
| `since` | `2d` | Gmail `newer_than:` qualifier. |
| `max_threads` | `50` | Hard cap; older threads spill to "next run". |
| `query_extra` | empty | Additional Gmail search qualifiers. |

## Outputs

- `vault/wiki/business/inbox-<today>.md` with frontmatter:
  ```yaml
  ---
  domain: business
  source: inbox-triage
  created: <today>
  updated: <today>
  tags: [inbox, triage]
  ---
  ```
  Sections: `## Reply now (drafted)`, `## Reply later`,
  `## Read & file`, `## Archive`, `## Spam/Promo`, `## Flagged`.
- Gmail drafts (saved, not sent) for the Reply-now bucket.

## Example

Prompt: "triage my inbox"

Output excerpt:
```markdown
# Inbox triage — 2026-05-10

## Reply now (drafted)
- **"Q2 review prep"** — from sarah@…  
  Asks for the slide outline by Friday. Draft saved (id: r-184a…).
- **"contract redline"** — from legal@…  
  Two redlines, both procedural. Draft confirms the changes.

## Reply later
- "newsletter feedback" — from a friend; needs thought, batch tonight.

## Read & file
- ACM newsletter — 1 article worth saving (linked).

## Archive
- 14 receipts and notification mails.

## Flagged
- "Suspicious sign-in from new device" — surfaced for the user; no draft.

## Stats
Threads scanned: 47. Drafts created: 2. Flagged: 1.
```

## Troubleshooting

- **Gmail MCP returns 401.** Token expired. Surface the exact MCP
  error and stop — the user needs to re-auth. Don't keep retrying.
- **Draft creation succeeds but draft doesn't appear.** Gmail
  occasionally lags on draft sync. Re-run `list_drafts` after 30s; if
  still missing, the create call probably hit a transient error and
  needs to be retried.
- **A thread spans multiple buckets** (e.g. starts as a newsletter,
  ends with a direct ask). Classify by the most recent message —
  that's the one the user has to respond to.
- **"Reply now" pile is huge.** If more than 10 threads land in
  Reply-now, that's a signal — surface that in the report header and
  draft the top 5 only. Drafting 30 mediocre replies is worse than
  drafting 5 good ones.
- **Privacy.** Don't write thread bodies into the report. One-line
  summaries only. The Gmail UI is the source of truth for content.
