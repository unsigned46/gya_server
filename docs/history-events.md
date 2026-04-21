# History Events

`state.json` stores the current bot state. `history.json` stores append-only event
history for later stats and review.

`history.json` is intentionally ignored by git because it is personal runtime data.

## Event Shape

```json
{
  "id": "1776254542343-0-session_opened",
  "type": "session_opened",
  "occurredAtMs": 1776254542343,
  "occurredAtIso": "2026-04-15T12:02:22.343Z",
  "dateKey": "2026-04-15",
  "sessionDateKey": "2026-04-15",
  "metadata": {
    "trigger": "schedule"
  }
}
```

## Current Event Types

| Type | When |
| --- | --- |
| `session_opened` | A daily, forced, acknowledgement, or pass-triggered session is created |
| `reminder_sent` | A reminder message is successfully sent |
| `session_started` | `/startwork`, `/ack`, or `/start` confirms work began |
| `session_snoozed` | `/snooze` defers the next reminder |
| `session_done` | `/done` marks the work session complete |
| `session_passed` | `/pass` marks the day as intentionally skipped |
| `session_stopped` | The bot gives up waiting for a start confirmation |
| `session_reset` | `/reset` clears the current session |

The important measurement for message tuning is `session_started.metadata.elapsedMs`,
which shows how long it took to start after the session opened.
