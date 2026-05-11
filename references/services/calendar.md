# Google Calendar

The Calendar MCP server exposes event read/write across the user's
calendars. This ref covers auth, the time-window query pattern, and
gotchas around recurring events.

## Auth scopes

| Capability | Available |
|---|---|
| List calendars | yes |
| List events on any calendar | yes |
| Get event by ID | yes |
| Create/update events | yes |
| Delete events | yes — **but skills should refuse unless explicitly asked** |
| RSVP / respond | yes |
| Suggest meeting times | yes |

Creates and updates are allowed, but a skill that does either as a
side effect (not because the user asked) should refuse and report.

## Rate limits

The MCP server uses the same Google Calendar API quota:

- **1,000,000 queries/day** (project-level).
- **600 queries/user/minute** (per-user, the limit you'll actually hit).

A skill that lists events across a week from three calendars uses
~5 queries. Bursting reads of 30+ events in a single skill run is
fine; the limit is only relevant for large historical sweeps.

## Time-window queries

`list_events` accepts ISO 8601 `timeMin` and `timeMax`. Skills should
always pass both — listing without a window returns the next ~250
events on the calendar, which is unbounded.

```
timeMin = today 00:00 (user TZ)
timeMax = today 23:59 (user TZ)
```

For "yesterday" or "last week" rollups, anchor the window to the
user's local TZ, not UTC. The MCP server accepts an offset suffix:
`2026-05-10T00:00:00-04:00`.

## Tool selection

- Today's events on the primary calendar → `list_events` with a
  one-day window. Default `calendarId` is "primary".
- Tomorrow's prep → `list_events` against tomorrow + each calendar
  returned by `list_calendars`.
- Finding a specific event → `get_event` with the ID, not a search.
  There is no full-text event search.
- Picking a free slot → `suggest_time` with the attendees + duration.
- Declining an invite → `respond_to_event` with `responseStatus:
  "declined"`. Does not delete the event.

## Common gotchas

- **Recurring events are expanded in `list_events`.** A weekly meeting
  returns one occurrence per matching week in the window. The
  `recurringEventId` field on each occurrence points to the master
  series — useful for de-duping when summarizing.
- **All-day events have `date`, not `dateTime`.** A naïve parse of
  `start.dateTime` will skip all-day events entirely. Check both.
- **Time zone surprises.** Each event has its own `timeZone` field;
  the user's primary TZ may differ. When grouping events by "day",
  do it in the user's TZ, not the event's.
- **Cancelled events** still appear with `status: "cancelled"` unless
  the calendar's `showDeleted` flag is off. Filter them out in the
  skill, not at query time, so re-runs are deterministic.
- **`suggest_time` does not check attendee availability across
  organizations.** It checks the calendars the MCP server has access
  to. External attendees' free/busy is invisible.
- **Multiple calendars per user.** Personal, work, holidays-in-region,
  shared team calendars — `list_calendars` returns all of them. A
  daily rollup that only reads "primary" misses work events on the
  work calendar.
