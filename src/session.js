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
    completedAtMs: null,
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
  recordEvent = () => {},
  sendMessage,
  now = () => Date.now(),
  readKstParts = getKstParts,
  readWeekKey = getWeekKey,
}) {
  let isSendingReminder = false;
  let eventSequence = 0;

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

  function recordSessionEvent(type, metadata = {}, parts = currentParts()) {
    const occurredAtMs = now();

    try {
      recordEvent({
        id: `${occurredAtMs}-${eventSequence++}-${type}`,
        type,
        occurredAtMs,
        occurredAtIso: new Date(occurredAtMs).toISOString(),
        dateKey: parts.dateKey,
        sessionDateKey: state.session ? state.session.dateKey : parts.dateKey,
        metadata,
      });
    } catch (error) {
      console.error('recordEvent error:', error.message);
    }
  }

  async function startDailySession(parts) {
    ensureCurrentWeeklyPassState();
    state.session = createWaitingSession(parts, now());

    saveState(state);
    recordSessionEvent('session_opened', { trigger: 'schedule' }, parts);
    await sendReminder(true);
  }

  async function forceStartSession() {
    const parts = currentParts();
    state.session = createWaitingSession(parts, now());
    saveState(state);
    recordSessionEvent('session_opened', { trigger: 'force' }, parts);
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
      const reminderIndex = state.session.reminderCount || 0;
      const text = getReminderText(elapsedMs, reminderIndex, config);
      const nextReminderDelayMs = getNextReminderDelay(elapsedMs, config);
      const phase =
        elapsedMs >= config.escalationAfterMs ? 'phase_two' : 'phase_one';

      await sendMessage(text);
      state.session.lastReminderAtMs = currentMs;
      state.session.reminderCount = reminderIndex + 1;
      state.session.nextReminderAtMs = currentMs + nextReminderDelayMs;
      saveState(state);
      recordSessionEvent('reminder_sent', {
        elapsedMs,
        message: text,
        nextReminderDelayMs,
        phase,
        reminderCount: state.session.reminderCount,
      });
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

    const currentMs = now();
    const elapsedMs = getElapsedMs(state.session, currentMs);

    state.session.mode = 'stopped';
    state.session.completedAtMs = null;
    state.session.stoppedAtMs = currentMs;
    state.session.stopReason = 'missed';
    state.session.nextReminderAtMs = null;
    saveState(state);
    recordSessionEvent('session_stopped', {
      elapsedMs,
      reason: 'missed',
      reminderCount: state.session.reminderCount || 0,
    });

    await sendMessage(config.messages.stopForNoStart);
  }

  async function acknowledgeStart() {
    const currentMs = now();
    const hadSession = Boolean(state.session);
    let openedParts = null;

    if (!state.session) {
      openedParts = currentParts();
      state.session = createWaitingSession(openedParts, currentMs);
      state.session.lastReminderAtMs = currentMs;
    }

    const elapsedMs = getElapsedMs(state.session, currentMs);
    const reminderCount = state.session.reminderCount || 0;

    state.session.acknowledgedAtMs = currentMs;
    state.session.mode = 'working';
    state.session.completedAtMs = null;
    state.session.stopReason = null;
    state.session.stoppedAtMs = null;
    state.session.nextReminderAtMs = null;
    saveState(state);

    if (!hadSession) {
      recordSessionEvent(
        'session_opened',
        { trigger: 'acknowledge' },
        openedParts
      );
    }

    recordSessionEvent('session_started', {
      elapsedMs,
      implicitSession: !hadSession,
      reminderCount,
    });
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

    if (state.session.mode === 'done') {
      return config.messages.statusDone({
        dateKey: state.session.dateKey,
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

  async function snoozeReminder(minutes) {
    if (!state.session || state.session.mode !== 'waiting') {
      await sendMessage(config.messages.snoozeNoWaitingSession);
      return;
    }

    const currentMs = now();
    const delayMs = minutes * 60 * 1000;

    state.session.nextReminderAtMs = currentMs + delayMs;
    saveState(state);
    recordSessionEvent('session_snoozed', {
      delayMs,
      elapsedMs: getElapsedMs(state.session, currentMs),
      minutes,
      reminderCount: state.session.reminderCount || 0,
    });
    await sendMessage(config.messages.snoozed({ minutes }));
  }

  async function completeSession() {
    if (!state.session) {
      await sendMessage(config.messages.doneNoSession);
      return;
    }

    if (state.session.mode === 'done') {
      await sendMessage(config.messages.doneAlready);
      return;
    }

    if (state.session.mode !== 'working' || !state.session.acknowledgedAtMs) {
      await sendMessage(config.messages.doneBeforeStart);
      return;
    }

    const currentMs = now();

    state.session.mode = 'done';
    state.session.completedAtMs = currentMs;
    state.session.nextReminderAtMs = null;
    saveState(state);
    recordSessionEvent('session_done', {
      elapsedMs: getElapsedMs(state.session, currentMs),
      workElapsedMs: currentMs - state.session.acknowledgedAtMs,
      reminderCount: state.session.reminderCount || 0,
    });
    await sendMessage(config.messages.done);
  }

  async function resetSession() {
    const previousSession = state.session
      ? {
          dateKey: state.session.dateKey,
          mode: state.session.mode,
        }
      : null;

    state.session = null;
    saveState(state);
    recordSessionEvent('session_reset', { previousSession });
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

    const openedForPass = !state.session || state.session.dateKey !== parts.dateKey;

    if (openedForPass) {
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

    const currentMs = now();
    const elapsedMs = getElapsedMs(state.session, currentMs);

    state.weeklyPass.used += 1;
    state.session.mode = 'passed';
    state.session.completedAtMs = null;
    state.session.stoppedAtMs = currentMs;
    state.session.stopReason = 'pass';
    state.session.nextReminderAtMs = null;
    saveState(state);

    if (openedForPass) {
      recordSessionEvent('session_opened', { trigger: 'pass' }, parts);
    }

    recordSessionEvent('session_passed', {
      elapsedMs,
      reminderCount: state.session.reminderCount || 0,
      weeklyPassUsed: state.weeklyPass.used,
      weeklyPassMax: config.maxWeeklyPasses,
    });

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
    completeSession,
    snoozeReminder,
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
