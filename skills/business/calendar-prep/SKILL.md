---
name: calendar-prep
description: Read today's calendar events across all calendars, add prep notes for each meeting (attendees, agenda, related vault context), detect conflicts and back-to-back blocks, and write a daily briefing. Use when asked for "prep my day", "calendar prep", "what's on the schedule", "daily briefing", "morning prep", or "what meetings do I have today".
license: MIT
metadata:
  status: authored
  domain: business
  mode: remote
  mcp-server: google-calendar
  external-apis: []
  outputs: [vault/raw/daily/<YYYY-MM-DD>-calendar-prep.md]
---

# Calendar Prep

Reads all of today's calendar events, enriches each with prep notes, surfaces
conflicts, and writes a structured daily briefing to the vault.

Uses the **sequential workflow** pattern: list calendars → list today's events
→ enrich each event → detect issues → write briefing.

## References

See `references/services/calendar.md` for:
- All-day events use `start.date` not `start.dateTime` — check both
- Filter out cancelled events (`status: "cancelled"`) after listing
- Always pass both `timeMin` and `timeMax` to `list_events`
- Multiple calendars per user — `list_calendars` first, then query each

## Instructions

### Step 1: Establish today's date and time window

Get the current date. Set:
```
timeMin = today 00:00:00 in user's local timezone
timeMax = today 23:59:59 in user's local timezone
```

If the user specifies a different date ("prep for tomorrow", "Wednesday's
schedule"), adjust accordingly.

### Step 2: List all calendars

Call `list_calendars`. Note the `id` of each calendar the user owns or
is subscribed to. Ignore "Holidays in [Country]" calendars unless the
user explicitly wants them included.

### Step 3: List today's events across all calendars

For each calendar ID, call `list_events` with the time window. Collect all
events into a single list. Deduplicate by `id` (recurring events that appear
on multiple calendars share an `id`).

Filter out:
- Events with `status: "cancelled"`
- Events the user declined (`attendees[].responseStatus == "declined"` for
  the user's own entry)

Sort the remaining events by `start.dateTime` (or `start.date` for all-day).

### Step 4: Enrich each event with prep notes

For each event, gather:

**From the event itself:**
- Title, start/end time, duration, location or video link
- Attendees (names + emails, flag external attendees)
- Description / agenda (if present)
- Whether it's a recurring meeting (`recurringEventId` field)

**From the vault:**
- Search `vault/raw/daily/` for any notes mentioning this event title or
  attendee names in the past 30 days. Quote relevant snippets.
- Check `vault/wiki/` for any standing notes about the attendees or topic.

**Prep questions to surface for each event (if no agenda is set):**
- What is the goal of this meeting?
- What decisions need to be made?
- What do I need to prepare or bring?

### Step 5: Detect scheduling issues

Flag any of the following:
- **Back-to-back meetings** with no break (end of one = start of next)
- **Overlapping events** (end time > start time of next event)
- **Long blocks** (single meeting > 2 hours without a break)
- **No agenda** on an external meeting (attendees outside your domain)
- **Travel time needed** if location changes between consecutive events

### Step 6: Write the briefing

Write to `vault/raw/daily/YYYY-MM-DD-calendar-prep.md`:

```markdown
---
date: YYYY-MM-DD
domain: [business]
source: calendar-prep
---

# YYYY-MM-DD Calendar Prep

## At a Glance
- N meetings, X hours blocked
- [any flags: conflicts, back-to-backs, missing agendas]

## Schedule

### HH:MM – HH:MM  Event Title
**Calendar:** [name]  **Duration:** Xh Ym
**Attendees:** [list, flagging external]
**Location/Link:** [if present]
**Agenda:** [from event description, or "None set"]

**Prep notes:**
- [vault context snippets if any]
- [prep questions if agenda missing]

---

[repeat for each event]

## Flags
[list any scheduling issues detected in Step 5]

## Free Blocks
[list gaps > 30 min between events]
```

Report the output file path to the user.

## Inputs

| Input | Description | Default |
|---|---|---|
| Date | Which day to prep for | Today |
| Calendars | Which calendars to include | All (from list_calendars) |

## Outputs

`vault/raw/daily/YYYY-MM-DD-calendar-prep.md` — structured daily briefing.

## Examples

**Today's prep:**
> "Prep my day"
→ Reads today's events, writes today's briefing.

**Tomorrow's prep:**
> "Prep tomorrow"
→ Adjusts time window to tomorrow's date.

**Specific calendar only:**
> "Prep my day, work calendar only"
→ Skips personal calendar events.

## Troubleshooting

**No events returned:** Confirm the time window is in the correct timezone.
The Calendar MCP uses the user's configured TZ; an offset mismatch returns
an empty day when there are events.

**Recurring events appear multiple times:** Deduplicate by `id` before
enriching. The `recurringEventId` field links instances to the master series.

**All-day events missing:** Check `start.date` (not `start.dateTime`) for
all-day events. Both fields must be checked in Step 3.
