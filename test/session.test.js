const assert = require('node:assert/strict');
const test = require('node:test');

const { buildConfig } = require('../src/config');
const { createSessionService, createWaitingSession } = require('../src/session');
const { createDefaultState } = require('../src/stateStore');

function createTestConfig(overrides = {}) {
  return {
    ...buildConfig({
      env: {
        START_HOUR: '20',
        START_MINUTE: '0',
        PHASE_ONE_INTERVAL_MINUTES: '1',
        ESCALATION_AFTER_MINUTES: '5',
        GIVE_UP_AFTER_MINUTES: '10',
        EMERGENCY_MIN_INTERVAL_SECONDS: '1',
        EMERGENCY_MAX_INTERVAL_SECONDS: '10',
        MAX_WEEKLY_PASSES: '5',
      },
      shouldLoadEnvFile: false,
    }),
    ...overrides,
  };
}

function createHarness({
  state = createDefaultState(),
  config = createTestConfig(),
  nowMs = 0,
  parts = {
    dateKey: '2026-04-21',
    hour: 20,
    minute: 0,
    second: 0,
    displayTime: '2026-04-21 20:00:00',
  },
} = {}) {
  const messages = [];
  const saves = [];
  let currentNowMs = nowMs;
  let currentParts = parts;

  const session = createSessionService({
    state,
    config,
    saveState: (nextState) => {
      saves.push(JSON.parse(JSON.stringify(nextState)));
    },
    sendMessage: async (message) => {
      messages.push(message);
    },
    now: () => currentNowMs,
    readKstParts: () => currentParts,
    readWeekKey: () => '2026-04-20',
    randomInt: (min) => min,
  });

  return {
    config,
    messages,
    saves,
    session,
    state,
    setNow: (nextNowMs) => {
      currentNowMs = nextNowMs;
    },
    setParts: (nextParts) => {
      currentParts = nextParts;
    },
  };
}

test('/startwork moves an empty session into working mode', async () => {
  const harness = createHarness({ nowMs: 1000 });

  await harness.session.acknowledgeStart();

  assert.equal(harness.state.session.mode, 'working');
  assert.equal(harness.state.session.acknowledgedAtMs, 1000);
  assert.equal(harness.state.session.nextReminderAtMs, null);
  assert.equal(
    harness.messages.at(-1),
    '[OK] 좋다. 이제 작업 모드다. 집중해서 밀어붙여라.'
  );
});

test('scheduler opens the daily session after the configured start time', async () => {
  const harness = createHarness({ nowMs: 2000 });

  await harness.session.tickScheduler();

  assert.equal(harness.state.session.mode, 'waiting');
  assert.equal(harness.state.session.dateKey, '2026-04-21');
  assert.equal(harness.state.session.reminderCount, 1);
  assert.equal(harness.messages[0], harness.config.phaseOneMessages[0]);
});

test('reminders escalate to phase two after the escalation window', async () => {
  const config = createTestConfig();
  const state = createDefaultState();
  state.session = createWaitingSession({ dateKey: '2026-04-21' }, 0);
  const harness = createHarness({
    config,
    state,
    nowMs: config.escalationAfterMs,
  });

  await harness.session.sendReminder(false);

  assert.equal(harness.messages[0], config.phaseTwoMessages[0]);
  assert.equal(
    harness.state.session.nextReminderAtMs,
    config.escalationAfterMs + config.emergencyMinIntervalMs
  );
});

test('waiting sessions stop after the give-up window', async () => {
  const config = createTestConfig();
  const state = createDefaultState();
  state.session = createWaitingSession({ dateKey: '2026-04-21' }, 0);
  const harness = createHarness({
    config,
    state,
    nowMs: config.giveUpAfterMs,
  });

  await harness.session.sendReminder(false);

  assert.equal(harness.state.session.mode, 'stopped');
  assert.equal(harness.state.session.stopReason, 'missed');
  assert.equal(harness.messages[0], config.disappointmentMessage);
});

test('weekly pass usage is counted and capped', async () => {
  const config = createTestConfig({ maxWeeklyPasses: 1 });
  const harness = createHarness({ config, nowMs: 3000 });

  await harness.session.usePass();
  await harness.session.usePass();

  assert.equal(harness.state.weeklyPass.used, 1);
  assert.equal(harness.state.session.mode, 'passed');
  assert.match(harness.messages[0], /이번 주 pass 1\/1/);
  assert.equal(harness.messages[1], '[PASS] 이번 주 pass는 전부 소진됐다. 1/1');
});
