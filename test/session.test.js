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
        PHASE_ONE_INTERVAL_MINUTES: '2',
        ESCALATION_AFTER_MINUTES: '6',
        GIVE_UP_AFTER_MINUTES: '15',
        PHASE_TWO_INTERVAL_SECONDS: '180',
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
  const events = [];
  const saves = [];
  let currentNowMs = nowMs;
  let currentParts = parts;

  const session = createSessionService({
    state,
    config,
    saveState: (nextState) => {
      saves.push(JSON.parse(JSON.stringify(nextState)));
    },
    recordEvent: (event) => {
      events.push(event);
    },
    sendMessage: async (message) => {
      messages.push(message);
    },
    now: () => currentNowMs,
    readKstParts: () => currentParts,
    readWeekKey: () => '2026-04-20',
  });

  return {
    config,
    events,
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
  assert.equal(harness.messages.at(-1), harness.config.messages.acknowledgement);
  assert.deepEqual(
    harness.events.map((event) => event.type),
    ['session_opened', 'session_started']
  );
  assert.equal(harness.events[1].metadata.elapsedMs, 0);
  assert.equal(harness.events[1].metadata.implicitSession, true);
});

test('scheduler opens the daily session after the configured start time', async () => {
  const harness = createHarness({ nowMs: 2000 });

  await harness.session.tickScheduler();

  assert.equal(harness.state.session.mode, 'waiting');
  assert.equal(harness.state.session.dateKey, '2026-04-21');
  assert.equal(harness.state.session.reminderCount, 1);
  assert.equal(harness.messages[0], harness.config.messages.phaseOneReminders[0]);
  assert.deepEqual(
    harness.events.map((event) => event.type),
    ['session_opened', 'reminder_sent']
  );
  assert.equal(harness.events[0].metadata.trigger, 'schedule');
  assert.equal(harness.events[1].metadata.phase, 'phase_one');
  assert.equal(harness.events[1].metadata.reminderCount, 1);
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

  assert.equal(harness.messages[0], config.messages.phaseTwoReminders[0]);
  assert.equal(
    harness.state.session.nextReminderAtMs,
    config.escalationAfterMs + config.phaseTwoIntervalMs
  );
  assert.equal(harness.events[0].type, 'reminder_sent');
  assert.equal(harness.events[0].metadata.phase, 'phase_two');
  assert.equal(harness.events[0].metadata.elapsedMs, config.escalationAfterMs);
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
  assert.equal(harness.messages[0], config.messages.stopForNoStart);
  assert.equal(harness.events[0].type, 'session_stopped');
  assert.equal(harness.events[0].metadata.reason, 'missed');
  assert.equal(harness.events[0].metadata.elapsedMs, config.giveUpAfterMs);
});

test('weekly pass usage is counted and capped', async () => {
  const config = createTestConfig({ maxWeeklyPasses: 1 });
  const harness = createHarness({ config, nowMs: 3000 });

  await harness.session.usePass();
  await harness.session.usePass();

  assert.equal(harness.state.weeklyPass.used, 1);
  assert.equal(harness.state.session.mode, 'passed');
  assert.equal(
    harness.messages[0],
    config.messages.passUsed({
      message: config.messages.passMessages[0],
      used: 1,
      max: 1,
    })
  );
  assert.equal(
    harness.messages[1],
    config.messages.passLimitReached({ used: 1, max: 1 })
  );
  assert.deepEqual(
    harness.events.map((event) => event.type),
    ['session_opened', 'session_passed']
  );
  assert.equal(harness.events[0].metadata.trigger, 'pass');
  assert.equal(harness.events[1].metadata.weeklyPassUsed, 1);
});

test('/snooze defers the next reminder for a waiting session', async () => {
  const state = createDefaultState();
  state.session = createWaitingSession({ dateKey: '2026-04-21' }, 0);
  const harness = createHarness({ state, nowMs: 10_000 });

  await harness.session.snoozeReminder(5);

  assert.equal(harness.state.session.nextReminderAtMs, 310_000);
  assert.equal(harness.events[0].type, 'session_snoozed');
  assert.equal(harness.events[0].metadata.minutes, 5);
  assert.equal(harness.events[0].metadata.elapsedMs, 10_000);
});

test('/done completes a working session and records work duration', async () => {
  const state = createDefaultState();
  state.session = createWaitingSession({ dateKey: '2026-04-21' }, 0);
  state.session.mode = 'working';
  state.session.acknowledgedAtMs = 60_000;
  const harness = createHarness({ state, nowMs: 660_000 });

  await harness.session.completeSession();

  assert.equal(harness.state.session.mode, 'done');
  assert.equal(harness.state.session.completedAtMs, 660_000);
  assert.equal(harness.events[0].type, 'session_done');
  assert.equal(harness.events[0].metadata.elapsedMs, 660_000);
  assert.equal(harness.events[0].metadata.workElapsedMs, 600_000);
});
