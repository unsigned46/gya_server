function createCommandHandler({ session, sendMessage, messages }) {
  return async function handleCommand(text) {
    if (text === '/forcestart') {
      await session.forceStartSession();
      return;
    }

    if (text === '/startwork' || text === '/ack' || text === '/start') {
      await session.acknowledgeStart();
      return;
    }

    if (text === '/status') {
      await sendMessage(session.getStatusMessage());
      return;
    }

    if (text === '/reset') {
      await session.resetSession();
      return;
    }

    if (text === '/pass') {
      await session.usePass();
      return;
    }

    if (text === '/help') {
      await sendMessage(messages.help);
    }
  };
}

module.exports = {
  createCommandHandler,
};
