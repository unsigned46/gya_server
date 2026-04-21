const fs = require('fs');

const { writeJsonFileAtomic } = require('./jsonFile');

function createDefaultHistory() {
  return {
    events: [],
  };
}

function loadHistory(historyFile) {
  try {
    const raw = fs.readFileSync(historyFile, 'utf-8');
    const parsed = JSON.parse(raw);

    if (!parsed || !Array.isArray(parsed.events)) {
      return createDefaultHistory();
    }

    return {
      events: parsed.events,
    };
  } catch {
    return createDefaultHistory();
  }
}

function saveHistory(historyFile, history) {
  writeJsonFileAtomic(historyFile, history);
}

function appendHistoryEvent(historyFile, event) {
  const history = loadHistory(historyFile);
  history.events.push(event);
  saveHistory(historyFile, history);
}

function createHistoryStore(historyFile) {
  return {
    append: (event) => appendHistoryEvent(historyFile, event),
    load: () => loadHistory(historyFile),
  };
}

module.exports = {
  appendHistoryEvent,
  createDefaultHistory,
  createHistoryStore,
  loadHistory,
  saveHistory,
};
