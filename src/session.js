const { getKstParts, getWeekKey } = require('./time');

function ensureWeeklyPassState(state, weekKey) {
  if (!state.weeklyPass || state.weeklyPass.weekKey !== weekKey) {
    state.weeklyPass = {
      weekKey,
      used: 0,
    };
  }
}

function getElapsedMs(session, nowMs = Date.now()) {
  return Math.max(0, nowMs - session.startedAtMs);
}

function getNextReminderDelay(elapsedMs, config) {
  if (elapsedMs >= config.escalationAfterMs) {
    return config.phaseTwoIntervalMs;
  }

  return config.phaseOneIntervalMs;
}

function getReminderText(elapsedMs, reminderCount, config) {
  if (elapsedMs >= config.escalationAfterMs) {
    return config.messages.phaseTwoReminders[
      reminderCount % config.messages.phaseTwoReminders.length
    ];
  }

  return config.messages.phaseOneReminders[
    reminderCount % config.messages.phaseOneReminders.length
  ];
}

function createWaitingSession(parts, nowMs = Date.now()) {
  return {
    dateKey: parts.dateKey,
    startedAtMs: nowMs,
    acknowledgedAtMs: null,
    lastReminderAtMs: 0,
    nextReminderAtMs: 0,
    reminderCount: 0,
    stoppedAtMs: null,
    stopReason: null,
    mode: 'waiting',
  };
}

function isAfterStartTime(parts, config) {
  return (
    parts.hour > config.startHour ||
    (parts.hour === config.startHour && parts.minute >= config.startMinute)
  );
}

function createSessionService({
  state,
  config,
  saveState = () => {},
  sendMessage,
  now = () => Date.now(),
  readKstParts = getKstParts,
  readWeekKey = getWeekKey,
}) {
  let isSendingReminder = false;

  function currentDate() {
    return new Date(now());
  }

  function currentParts() {
    return readKstParts(currentDate(), config.timeZone);
  }

  function currentWeekKey() {
    return readWeekKey(currentDate(), config.timeZone);
  }

  function ensureCurrentWeeklyPassState() {
    ensureWeeklyPassState(state, currentWeekKey());
  }

  async function startDailySession(parts) {
    ensureCurrentWeeklyPassState();
    state.session = createWaitingSession(parts, now());

    saveState(state);
    await sendReminder(true);
  }

  async function forceStartSession() {
    state.session = createWaitingSession(currentParts(), now());
    saveState(state);
    await sendReminder(true);
  }

  async function sendReminder(force = false) {
    if (!state.session || state.session.mode !== 'waiting' || isSendingReminder) {
      return;
    }

    const currentMs = now();
    const elapsedMs = getElapsedMs(state.session, currentMs);

    if (elapsedMs >= config.giveUpAfterMs) {
      await stopSessionForNoStart();
      return;
    }

    const due =
      force ||
      !state.session.nextReminderAtMs ||
      currentMs >= state.session.nextReminderAtMs;

    if (!due) {
      return;
    }

    isSendingReminder = true;

    try {
      await sendMessage(
        getReminderText(elapsedMs, state.session.reminderCount || 0, config)
      );
      state.session.lastReminderAtMs = currentMs;
      state.session.reminderCount = (state.session.reminderCount || 0) + 1;
      state.session.nextReminderAtMs =
        currentMs + getNextReminderDelay(elapsedMs, config);
      saveState(state);
    } catch (error) {
      console.error('sendReminder error:', error);
    } finally {
      isSendingReminder = false;
    }
  }

  async function stopSessionForNoStart() {
    if (!state.session || state.session.mode !== 'waiting') {
      return;
    }

    state.session.mode = 'stopped';
    state.session.stoppedAtMs = now();
    state.session.stopReason = 'missed';
    state.session.nextReminderAtMs = null;
    saveState(state);

    await sendMessage(config.messages.stopForNoStart);
  }

  async function acknowledgeStart() {
    const currentMs = now();

    if (!state.session) {
      state.session = createWaitingSession(currentParts(), currentMs);
      state.session.lastReminderAtMs = currentMs;
    }

    state.session.acknowledgedAtMs = currentMs;
    state.session.mode = 'working';
    state.session.stopReason = null;
    state.session.stoppedAtMs = null;
    state.session.nextReminderAtMs = null;
    saveState(state);
    await sendMessage(config.messages.acknowledgement);
  }

  function getStatusMessage() {
    ensureCurrentWeeklyPassState();

    if (!state.session) {
      return config.messages.statusNoSession({
        used: state.weeklyPass.used,
        max: config.maxWeeklyPasses,
      });
    }

    if (state.session.acknowledgedAtMs) {
      return config.messages.statusWorking({
        dateKey: state.session.dateKey,
        used: state.weeklyPass.used,
        max: config.maxWeeklyPasses,
      });
    }

    if (state.session.mode === 'passed') {
      return config.messages.statusPassed({
        dateKey: state.session.dateKey,
        used: state.weeklyPass.used,
        max: config.maxWeeklyPasses,
      });
    }

    if (state.session.mode === 'stopped') {
      return config.messages.statusStopped({
        dateKey: state.session.dateKey,
        used: state.weeklyPass.used,
        max: config.maxWeeklyPasses,
      });
    }

    const elapsedSeconds = Math.floor(getElapsedMs(state.session, now()) / 1000);
    return config.messages.statusWaiting({
      dateKey: state.session.dateKey,
      elapsedSeconds,
      used: state.weeklyPass.used,
      max: config.maxWeeklyPasses,
    });
  }

  async function resetSession() {
    state.session = null;
    saveState(state);
    await sendMessage(config.messages.reset);
  }

  async function usePass() {
    ensureCurrentWeeklyPassState();

    if (state.weeklyPass.used >= config.maxWeeklyPasses) {
      await sendMessage(
        config.messages.passLimitReached({
          used: state.weeklyPass.used,
          max: config.maxWeeklyPasses,
        })
      );
      return;
    }

    const parts = currentParts();

    if (!isAfterStartTime(parts, config)) {
      await sendMessage(config.messages.passBeforeStart);
      return;
    }

    if (!state.session || state.session.dateKey !== parts.dateKey) {
      state.session = createWaitingSession(parts, now());
    }

    if (state.session.mode === 'working') {
      await sendMessage(config.messages.passAlreadyWorking);
      return;
    }

    if (state.session.mode === 'passed') {
      await sendMessage(
        config.messages.passAlreadyUsed({
          used: state.weeklyPass.used,
          max: config.maxWeeklyPasses,
        })
      );
      return;
    }

    state.weeklyPass.used += 1;
    state.session.mode = 'passed';
    state.session.stoppedAtMs = now();
    state.session.stopReason = 'pass';
    state.session.nextReminderAtMs = null;
    saveState(state);

    const message =
      config.messages.passMessages[
        (state.weeklyPass.used - 1) % config.messages.passMessages.length
      ];
    await sendMessage(
      config.messages.passUsed({
        message,
        used: state.weeklyPass.used,
        max: config.maxWeeklyPasses,
      })
    );
  }

  async function tickScheduler() {
    ensureCurrentWeeklyPassState();

    const parts = currentParts();

    if (
      isAfterStartTime(parts, config) &&
      (!state.session || state.session.dateKey !== parts.dateKey)
    ) {
      await startDailySession(parts);
      return;
    }

    if (
      state.session &&
      state.session.dateKey === parts.dateKey &&
      state.session.mode === 'waiting'
    ) {
      await sendReminder(false);
    }
  }

  return {
    acknowledgeStart,
    forceStartSession,
    getStatusMessage,
    resetSession,
    sendReminder,
    startDailySession,
    stopSessionForNoStart,
    tickScheduler,
    usePass,
  };
}

module.exports = {
  createSessionService,
  createWaitingSession,
  ensureWeeklyPassState,
  getElapsedMs,
  getNextReminderDelay,
  getReminderText,
  isAfterStartTime,
};
