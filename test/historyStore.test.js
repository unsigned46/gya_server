const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');

const {
  appendHistoryEvent,
  loadHistory,
} = require('../src/historyStore');

function createTempHistoryFile(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'gya-history-'));
  t.after(() => {
    fs.rmSync(directory, { recursive: true, force: true });
  });

  return path.join(directory, 'history.json');
}

test('history store appends events in order', (t) => {
  const historyFile = createTempHistoryFile(t);

  appendHistoryEvent(historyFile, { type: 'session_opened' });
  appendHistoryEvent(historyFile, { type: 'reminder_sent' });

  assert.deepEqual(loadHistory(historyFile), {
    events: [{ type: 'session_opened' }, { type: 'reminder_sent' }],
  });
});

test('history store recovers from missing or invalid files', (t) => {
  const historyFile = createTempHistoryFile(t);

  assert.deepEqual(loadHistory(historyFile), { events: [] });

  fs.writeFileSync(historyFile, 'not-json', 'utf-8');

  assert.deepEqual(loadHistory(historyFile), { events: [] });
});
