# Gmail MCP — service reference

Used by skills that read inbox threads or save drafts. The MCP server
in this repo's setup exposes `search_threads`, `get_thread`,
`list_drafts`, `create_draft`, `create_label`, `list_labels`.

## Auth

OAuth 2.0. Required scopes for skills in this repo:

| Operation | Scope |
|---|---|
| Read messages and threads | `https://www.googleapis.com/auth/gmail.readonly` |
| Create drafts | `https://www.googleapis.com/auth/gmail.compose` |
| Apply labels / archive | `https://www.googleapis.com/auth/gmail.modify` |
| Send (we don't) | `https://www.googleapis.com/auth/gmail.send` |

**Skills in this repo never use `gmail.send`.** Drafting is the
maximum write authority; the user reviews and sends manually. If a
skill wants to send, that's a deliberate scope expansion the user
approves separately.

## Rate limits

Gmail uses **quota units**, not request counts:
- **Per user:** 250 quota units/sec.
- **Per project:** 1,200,000,000 units/day.

Approximate cost of operations skills use:
- `messages.list` / `threads.list` — 5 units.
- `messages.get` / `threads.get` (full message) — 5 units.
- `drafts.create` — 10 units.
- `messages.modify` (label change) — 5 units.

Reading 50 threads at full message detail: ~250 units, well under
the 250/sec cap as long as it isn't fired in one burst.

## Tool selection

- **`search_threads`** with a Gmail query (`in:inbox is:unread
  newer_than:2d`) is much cheaper than `list_threads` + filter.
- **`get_thread`** returns the whole thread (all messages); avoid
  calling `get_message` per id when you need siblings too.
- **`create_draft`** saves to drafts immediately, but the new draft
  may take ~5–30s to appear in `list_drafts` due to indexing.
- **Labels are case-sensitive.** `INBOX` is a system label. Custom
  labels are user-defined and may have arbitrary case.

## Common errors

| Status | Meaning | Action |
|---|---|---|
| 401 | Token invalid or expired | Surface to user; don't retry. |
| 403 + "Insufficient Permission" | Scope missing | Surface with the scope name. |
| 429 | Per-user quota exceeded (>250/s burst) | Backoff exponentially; usually clears in <1s. |
| 404 on `get_thread` | Thread was deleted between search and get | Skip; don't fail the whole run. |
| 400 + "Invalid query" | Malformed Gmail search syntax | Echo the query that failed. |

## Gotchas

- **Threads vs messages.** A thread is a chain. The "subject" can
  drift across messages in the same thread. Triage by the most recent
  message, not the first.
- **`UNREAD` is a label**, not a separate state. `is:unread` in a
  search and removing the `UNREAD` label both work; pick one and
  stick with it.
- **Drafts attach to a thread**, not just an address. When creating a
  reply draft, set the `threadId` to keep it in the conversation —
  otherwise it shows up as a new thread.
- **Quoted history balloons message size.** A thread with 20 messages
  can be tens of KB. For triage, the latest message body is usually
  enough; don't load the full thread blob unless you need it.
- **Indexing lag.** Newly created drafts can take ~30s to appear in
  `list_drafts`. Don't fail a run because the draft you just created
  isn't visible yet.

## Privacy

This is the most sensitive surface in the repo.

- **Never write thread bodies to the vault.** One-line summaries
  only. Gmail UI is the source of truth for content.
- **Never log message bodies in dashboard run output.** The dashboard
  persists run history; bodies in there are a leak.
- **Don't auto-archive/delete.** Drafts are saved (never sent); other
  bins are listed for the user to sweep manually.
- **Surface security flags inline.** Anything Gmail has flagged as
  phishing or "suspicious sign-in" goes in the response, not just
  the report file.

## See also

- Authoritative docs: <https://developers.google.com/gmail/api/guides>
- Quota detail:
  <https://developers.google.com/gmail/api/reference/quota>
- Inbox-triage rubric:
  `skills/business/inbox-triage/references/triage-rubric.md`
