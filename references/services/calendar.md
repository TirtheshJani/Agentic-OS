# Google Calendar MCP — service reference

Used by skills that read events for prep / rollups. The MCP exposes
`list_calendars`, `list_events`, `get_event`, `create_event`,
`update_event`, `delete_event`, `respond_to_event`, `suggest_time`.

## Auth

OAuth 2.0. Required scopes:

| Operation | Scope |
|---|---|
| Read events | `https://www.googleapis.com/auth/calendar.events.readonly` |
| Create / update / delete events | `https://www.googleapis.com/auth/calendar.events` |
| Read calendar list | `https://www.googleapis.com/auth/calendar.readonly` |

Skills in this repo currently only need the readonly scopes. If a
skill wants to create or modify events, escalate that scope expansion
to the user before adding the call.

## Rate limits

- **Per user:** 60 requests/sec.
- **Per project:** 1,000,000 requests/day.

Reading a day's events on the primary calendar is ~1 request. Even an
aggressive workflow won't get close to limits.

## Tool selection

- **`list_events`** with a `timeMin` / `timeMax` window is the only
  efficient way to read a day. Don't call `get_event` in a loop.
- **`list_calendars`** is rarely needed — `primary` works as a
  pseudonym for the user's main calendar.
- **`suggest_time`** is useful for scheduling skills but expensive
  (multiple internal calls); prefer it over hand-rolled availability
  logic when the user is asking "find me a slot".

## Time and timezone

Calendar API uses **RFC 3339** timestamps with timezone offsets:
`2026-05-10T09:00:00-07:00`.

- Pass `timeMin` / `timeMax` with explicit offsets — naive
  ISO-without-offset is rejected.
- Per-event `start.timeZone` / `end.timeZone` is the IANA name (e.g.
  `America/Los_Angeles`). Convert to the user's local zone for
  display.
- **All-day events** use `start.date` / `end.date` (`YYYY-MM-DD`)
  instead of `start.dateTime` / `end.dateTime`. Always check which
  shape an event has before reading the field.
- `end.date` for all-day events is **exclusive** (a single-day event
  on May 10 has `end.date: 2026-05-11`). Don't display that as
  "two-day event".

## Common errors

| Status | Meaning | Action |
|---|---|---|
| 401 | Token invalid | Surface; don't retry. |
| 403 | Scope missing or calendar access denied | Surface with the calendar id. |
| 404 | Calendar id doesn't exist or user lost access | Distinguish via `list_calendars`. |
| 410 | Event was deleted (sync token expired) | Drop the sync token, full re-list. |
| 429 | Rate limit | Backoff exponentially; rare in practice. |

## Gotchas

- **Recurring events return one master + N instances.** `list_events`
  with `singleEvents=true` expands them; without the flag, you get
  the master only. For "what's on my calendar today", always use
  `singleEvents=true`.
- **Declined events still appear** in `list_events`. Filter by
  `attendees[?email==me].responseStatus != 'declined'` if the skill
  cares about confirmed attendance.
- **Cancelled events are present with `status: cancelled`** if you
  pass `showDeleted=true`. Default omits them, which is usually what
  you want.
- **Working-hours / out-of-office events** appear as regular events
  with `eventType: 'workingLocation'` or `eventType:
  'outOfOffice'`. Filter these out for "today's meetings" queries.
- **Conferencing data** (Meet/Zoom URL) is on the event under
  `conferenceData.entryPoints[?entryPointType=='video']`. It's not
  always present even when the event is video-only.

## See also

- Authoritative docs: <https://developers.google.com/calendar/api>
- Event resource:
  <https://developers.google.com/calendar/api/v3/reference/events>
