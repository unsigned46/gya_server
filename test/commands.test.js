const assert = require('node:assert/strict');
const test = require('node:test');

const { parseCommand, parseMinutes } = require('../src/commands');

test('parseCommand accepts bot-specific telegram command names', () => {
  assert.deepEqual(parseCommand('/help@my_bot extra'), {
    args: ['extra'],
    command: '/help',
  });
});

test('parseMinutes uses defaults and rejects invalid values', () => {
  assert.equal(parseMinutes(undefined, 5, 60), 5);
  assert.equal(parseMinutes('15', 5, 60), 15);
  assert.equal(parseMinutes('0', 5, 60), null);
  assert.equal(parseMinutes('61', 5, 60), null);
  assert.equal(parseMinutes('soon', 5, 60), null);
});
