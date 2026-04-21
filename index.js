const path = require('path');

const { buildConfig, validateConfig } = require('./src/config');
const { createCommandHandler } = require('./src/commands');
const { createSessionService } = require('./src/session');
const { createStateStore } = require('./src/stateStore');
const { createTelegramClient } = require('./src/telegram');
const { getKstParts } = require('./src/time');

const STATE_FILE = path.join(__dirname, 'state.json');

const config = buildConfig({
  envFile: path.join(__dirname, '.env'),
});
validateConfig(config);

const stateStore = createStateStore(STATE_FILE);
const state = stateStore.load();
const telegram = createTelegramClient({
  token: config.token,
  chatId: config.chatId,
});
const session = createSessionService({
  state,
  config,
  saveState: stateStore.save,
  sendMessage: telegram.sendMessage,
});
const handleCommand = createCommandHandler({
  session,
  sendMessage: telegram.sendMessage,
  messages: config.messages,
});

let isPolling = false;

async function pollUpdates() {
  if (isPolling) {
    return;
  }

  isPolling = true;

  try {
    const offset = state.lastUpdateId + 1;
    const updates = await telegram.telegramGet(
      `getUpdates?timeout=0&offset=${offset}`
    );

    if (!Array.isArray(updates) || updates.length === 0) {
      return;
    }

    for (const update of updates) {
      state.lastUpdateId = update.update_id;

      const message = update.message;
      if (!message || !message.text) {
        continue;
      }

      if (String(message.chat.id) !== String(config.chatId)) {
        continue;
      }

      await handleCommand(message.text.trim());
    }

    stateStore.save(state);
  } catch (error) {
    console.error('pollUpdates error:', error.message);
  } finally {
    isPolling = false;
  }
}

console.log(
  `[boot] scheduler started at KST ${
    getKstParts(new Date(), config.timeZone).displayTime
  }`
);

setInterval(() => {
  pollUpdates().catch((error) => {
    console.error('poll loop error:', error.message);
  });
}, config.pollIntervalMs);

setInterval(() => {
  session.tickScheduler().catch((error) => {
    console.error('scheduler error:', error.message);
  });
}, config.schedulerIntervalMs);

pollUpdates().catch((error) => {
  console.error('initial poll error:', error.message);
});

session.tickScheduler().catch((error) => {
  console.error('initial scheduler error:', error.message);
});
