# Gmail

The Gmail MCP server exposes labels, threads, drafts, and search. This
ref covers auth, the search query language, and the **privacy rule**
every Gmail-touching skill must follow.

## Auth scopes

The configured server has these scopes:

| Capability | Available |
|---|---|
| Read inboxes, threads, message metadata | yes |
| Search threads | yes |
| Create drafts | yes |
| Apply/remove labels | yes |
| Send mail | **no** — skills must not send |
| Delete mail | **no** — skills must not delete |

Skills draft and label only. If a skill needs to send, that's a
person-in-the-loop step using the Gmail UI, not an automated send.

## Privacy rule (non-negotiable)

**Thread bodies never appear in skill output that lands outside the
vault.**

Concretely:

- Reports written to `vault/raw/daily/` or `vault/outputs/` may
  reference threads **by subject + sender + thread ID**, never by
  body content.
- The dashboard's Recent Runs card surfaces the prompt and a short
  output preview. Skills that handle inboxes must not put body text
  in the assistant's final message — only counts, labels, and IDs.
- If a user explicitly asks for body content (e.g. "summarize this
  thread"), one-shot output is fine; do not persist it.

Why: a vault file becomes a git commit becomes a remote. The Gmail UI
is the source of truth for thread bodies; the vault stores derived
metadata only.

## Rate limits

| Operation class | Quota |
|---|---|
| Read (search, get) | 250 quota units/user/second |
| Modify (label, draft) | 250 quota units/user/second |
| Daily quota | 1,000,000,000 units/day |

In practice the per-second limit is the only one a skill will hit.
Bursting 50 thread reads in a tight loop is fine; 500 in a tight loop
trips it.

## Search query syntax

Standard Gmail operators apply:

```
from:alice@example.com is:unread
label:newsletter older_than:7d
has:attachment subject:invoice
{ from:a@x.com OR from:b@y.com }
```

Useful for triage:

- `is:unread newer_than:1d` — today's unread.
- `is:unread -category:promotions -category:social` — actionable unread.
- `label:^t` — starred threads only (the Gmail internal label).

## Tool selection

- Listing threads matching a query → `search_threads`. Returns thread
  IDs + a one-line snippet (the snippet is acceptable for vault output;
  full bodies are not).
- Reading one thread → `get_thread`. Use only when an explicit
  user-driven workflow needs the body.
- Drafting a reply → `create_draft` with the thread ID.
- Tagging — `label_message` for one message, `label_thread` for the
  whole thread. Use thread-level for triage; message-level for
  per-message routing.

## Common gotchas

- **Label names are case-sensitive.** "Newsletter" and "newsletter"
  are different labels.
- **System labels start with `^`** in the API: `^t` (starred),
  `^im` (important), `^smartlabel_personal`. Don't show these in
  user-facing output.
- **Snippets are truncated mid-word** at ~200 chars. Treat them as a
  preview, not the message.
- **`category:` is not the same as `label:`** — Gmail's categories
  (Primary, Social, Promotions, Updates, Forums) live in a separate
  namespace; query with `category:promotions`.
- **A thread can have one or many messages.** Loops that assume one
  message per thread will miss content. Iterate `messages[]`.
- **Draft creation does not send.** A draft sits in the Drafts folder
  until the user opens it and clicks send. This is the design — do
  not work around it.
