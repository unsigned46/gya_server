function parseCommand(text) {
  const [rawCommand = '', ...args] = text.trim().split(/\s+/);
  const command = rawCommand.split('@')[0].toLowerCase();

  return {
    args,
    command,
  };
}

function parseMinutes(value, fallbackValue, maxValue) {
  if (value === undefined || value === '') {
    return fallbackValue;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1 || parsed > maxValue) {
    return null;
  }

  return parsed;
}

function createCommandHandler({
  config,
  getWeeklyReviewMessage,
  messages,
  sendMessage,
  session,
}) {
  return async function handleCommand(text) {
    const { args, command } = parseCommand(text);

    if (command === '/forcestart') {
      await session.forceStartSession();
      return;
    }

    if (command === '/startwork' || command === '/ack' || command === '/start') {
      await session.acknowledgeStart();
      return;
    }

    if (command === '/status') {
      await sendMessage(session.getStatusMessage());
      return;
    }

    if (command === '/reset') {
      await session.resetSession();
      return;
    }

    if (command === '/pass') {
      await session.usePass();
      return;
    }

    if (command === '/snooze') {
      const minutes = parseMinutes(
        args[0],
        config.defaultSnoozeMinutes,
        config.maxSnoozeMinutes
      );

      if (minutes === null) {
        await sendMessage(messages.snoozeMinutesInvalid);
        return;
      }

      await session.snoozeReminder(minutes);
      return;
    }

    if (command === '/done' || command === '/complete') {
      await session.completeSession();
      return;
    }

    if (command === '/week') {
      await sendMessage(getWeeklyReviewMessage());
      return;
    }

    if (command === '/help') {
      await sendMessage(messages.help);
    }
  };
}

module.exports = {
  createCommandHandler,
  parseCommand,
  parseMinutes,
};
