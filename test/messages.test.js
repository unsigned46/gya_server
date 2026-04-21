const assert = require('node:assert/strict');
const test = require('node:test');

const {
  buildMessages,
  getPersonaBuilder,
  normalizePersonaName,
} = require('../src/messages');

test('buildMessages uses the butler persona by default', () => {
  const messages = buildMessages({ startHour: 21, startMinute: 1 });

  assert.match(messages.phaseOneReminders[0], /입니다/);
  assert.match(messages.help, /사용 가능한 명령어/);
});

test('buildMessages selects gigachad persona', () => {
  const messages = buildMessages({
    persona: 'gigachad',
    startHour: 21,
    startMinute: 1,
  });

  assert.match(messages.phaseOneReminders[0], /왕의 시간/);
  assert.match(messages.help, /커맨드 리스트/);
});

test('buildMessages selects yandere persona', () => {
  const messages = buildMessages({
    persona: 'yandere',
    startHour: 21,
    startMinute: 1,
  });

  assert.match(messages.phaseOneReminders[0], /보고 있어/);
  assert.match(messages.help, /네가 부를 수 있는 명령어/);
});

test('unknown persona fails fast', () => {
  assert.throws(
    () =>
      buildMessages({
        persona: 'unknown',
        startHour: 21,
        startMinute: 1,
      }),
    /Unknown MESSAGE_PERSONA/
  );
});

test('persona aliases map to the butler builder', () => {
  assert.equal(normalizePersonaName(' DEFAULT '), 'default');
  assert.equal(getPersonaBuilder('default'), getPersonaBuilder('butler'));
  assert.equal(getPersonaBuilder('basic'), getPersonaBuilder('butler'));
});
