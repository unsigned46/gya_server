# gya-be

Personal Telegram work-start reminder bot.

## Commands

| Command | Purpose |
| --- | --- |
| `/startwork` | Confirm today's work has started |
| `/status` | Show current session state |
| `/snooze 5` | Delay the next reminder by 5 minutes |
| `/done` | Mark today's work session complete |
| `/pass` | Intentionally skip today's session |
| `/week` | Show the current weekly review |
| `/forcestart` | Open a session immediately |
| `/reset` | Clear the current session state |
| `/help` | Show command list |

## Local Setup

1. Copy `.env.example` to `.env`.
2. Fill in `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`.
3. Adjust the timing values if needed.

```powershell
npm.cmd test
node index.js
```

PowerShell may block `npm test` through `npm.ps1`; use `npm.cmd test` on Windows.

## Runtime Data

These files are intentionally ignored by git:

- `.env`
- `state.json`
- `history.json`

`state.json` stores current state. `history.json` stores event history for `/week`
and future stats.

## Operational Notes

- JSON state/history writes are atomic: the bot writes a temporary file and then
  renames it into place.
- If the bot exits, restart it with `node index.js`.
- For always-on use, run it under a process manager or Windows Task Scheduler.
