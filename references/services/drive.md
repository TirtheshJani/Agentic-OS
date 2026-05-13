# Google Drive

The Drive MCP server exposes search, read, and create tooling against
the connected user's Google Drive. This ref is the central source of
rate limits, auth gotchas, and tool selection for every skill that
touches Drive. Drive is the archival sink for content too large for
the vault (>1 MB binaries) per `vault/CLAUDE.md` — raw scraped bodies,
cached PDFs, source archives — anything the vault would bloat on.

## Auth scopes

OAuth user-scoped. The MCP server is configured with **read + write**
to the connected user's personal Drive. It cannot access shared drives
owned by other users unless those files have been explicitly shared
with the connected account.

| Capability | Access |
|---|---|
| Read files in connected user's Drive | configured |
| Write files to connected user's Drive | configured |
| Read files explicitly shared with the user | configured (via share) |
| Read shared drives the user doesn't own | not authorized unless shared |
| Impersonate another user | not supported |

A 403 on a read of a known-existing file usually means the file is
sharing-restricted, not that auth needs fixing. See error decoding below.

## Rate limits

Drive enforces per-user-per-100-seconds quotas on the default project:

| Quota | Default limit |
|---|---|
| Read requests | 20,000 / 100s / user |
| Write requests | 12,000 / 100s / user |
| Read burst (per second) | ~1,000 / s |
| Write burst (per second) | ~100 / s |

When the quota trips the API returns **HTTP 429** with a documented
exponential-backoff schedule: start at 1s, double to 2s, 4s, 8s, 16s,
32s, then give up. The MCP server does not auto-retry; skills must
implement the backoff themselves or fail loudly.

## Tool selection

Decision tree, cheapest first:

- **Looking up a known file (ID in hand)** → `get_file_metadata` to
  check properties (size, mimeType, modifiedTime) **before**
  `read_file_content`. Cheap; avoids downloading a 100 MB file to find
  out it's the wrong one.
- **Finding files by name or content** → `search_files` with Drive
  Query Language. Examples:
  - `name contains 'morning-scan'`
  - `mimeType='application/pdf' and modifiedTime > '2026-05-01'`
  - `parents in '<folder-id>' and trashed=false`
- **Need recent activity** → `list_recent_files` (more efficient than
  a date-range search).
- **Reading content**:
  - Text (Docs, Markdown, plain text) → `read_file_content`
  - Binary (PDF, image, archive) → `download_file_content`
- **Writing**:
  - New content → `create_file`
  - Duplicating an existing file → `copy_file` (preserves metadata
    and parent permissions; faster than read + create)
- **Inspecting sharing before writing sensitive content** →
  `get_file_permissions` on the destination folder.

## Common error decoding

| Status | Meaning | Action |
|---|---|---|
| 401 | Token expired or not configured | Refresh required, not retryable |
| 403 | Insufficient scope OR sharing-restricted | Check `get_file_permissions`; needs "viewer" role minimum |
| 404 | File doesn't exist OR user has no access | Drive returns 404 (not 403) in some cases to avoid leaking existence — treat as "not reachable" |
| 429 | Rate limit | Backoff: 1s → 2s → 4s → 8s → 16s → 32s, then fail |
| 500 / 503 | Transient Drive backend error | Retry with backoff, max 3 attempts |

A 401 should never be retried in-loop — stop and report the config issue.

## Common gotchas

- **No implicit folder creation.** `create_file` with a path including
  a non-existent folder fails. Create parent folders first, or write
  to the Drive root.
- **Folders are a mimetype, not a separate object.** Folders have
  `mimeType=application/vnd.google-apps.folder`; treat them as
  containers, not readable files. `read_file_content` on a folder will
  error or return junk.
- **Google Docs/Sheets/Slides have no native bytes.**
  `download_file_content` on a Google Doc returns an **export**
  (default DOCX). Specify the target `mimeType` in the call to control
  the export format (PDF, plain text, HTML).
- **Search Query Language quirks.** `name contains '...'` is fuzzy
  (partial substring match); `name = '...'` is exact. Single quotes
  inside a query value must be escaped with a backslash (`\'`).
- **Trashed files appear in search by default.** Always include
  `trashed=false` in the query unless you specifically want trashed
  results.
- **File IDs are stable; names are not.** Once a skill has a file ID,
  prefer it over re-searching by name on subsequent runs. Avoids
  name-collision bugs and is one round-trip cheaper.
- **Sharing inheritance.** Files inherit their parent folder's
  permissions unless explicitly overridden. Before `create_file`-ing
  sensitive content, `get_file_permissions` on the destination folder
  to confirm it's not shared externally.
- **MimeType filtering is strict.** `mimeType='application/pdf'` won't
  match a PDF whose Drive metadata says `application/octet-stream`
  (which happens on some uploads). Fall back to a name suffix check.
