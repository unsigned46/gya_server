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

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getNextReminderDelay(elapsedMs, config, randomInt = getRandomInt) {
  if (elapsedMs >= config.escalationAfterMs) {
    return randomInt(
      config.emergencyMinIntervalMs,
      config.emergencyMaxIntervalMs
    );
  }

  return config.phaseOneIntervalMs;
}

function getReminderText(elapsedMs, reminderCount, config) {
  if (elapsedMs >= config.escalationAfterMs) {
    return config.phaseTwoMessages[reminderCount % config.phaseTwoMessages.length];
  }

  return config.phaseOneMessages[reminderCount % config.phaseOneMessages.length];
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
  randomInt = getRandomInt,
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
        currentMs + getNextReminderDelay(elapsedMs, config, randomInt);
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

    await sendMessage(config.disappointmentMessage);
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
    await sendMessage('[OK] 좋다. 이제 작업 모드다. 집중해서 밀어붙여라.');
  }

  function getStatusMessage() {
    ensureCurrentWeeklyPassState();

    if (!state.session) {
      return `[STATUS] 오늘 세션은 아직 열리지 않았다. 이번 주 pass ${state.weeklyPass.used}/${config.maxWeeklyPasses}`;
    }

    if (state.session.acknowledgedAtMs) {
      return `[OK] ${state.session.dateKey} 세션은 이미 시작됐다. 이번 주 pass ${state.weeklyPass.used}/${config.maxWeeklyPasses}`;
    }

    if (state.session.mode === 'passed') {
      return `[PASS] ${state.session.dateKey} 오늘은 전략적 pass다. 이번 주 pass ${state.weeklyPass.used}/${config.maxWeeklyPasses}`;
    }

    if (state.session.mode === 'stopped') {
      return `[STOP] ${state.session.dateKey} 오늘 세션은 종료됐다. 이번 주 pass ${state.weeklyPass.used}/${config.maxWeeklyPasses}`;
    }

    const elapsedSeconds = Math.floor(getElapsedMs(state.session, now()) / 1000);
    return `[WAIT] ${state.session.dateKey} 아직 시작 전이다. ${elapsedSeconds}초 지났다. 이번 주 pass ${state.weeklyPass.used}/${config.maxWeeklyPasses}`;
  }

  async function resetSession() {
    state.session = null;
    saveState(state);
    await sendMessage('[RESET] 오늘 세션 상태를 초기화했다. 다시 제대로 시작하면 된다.');
  }

  async function usePass() {
    ensureCurrentWeeklyPassState();

    if (state.weeklyPass.used >= config.maxWeeklyPasses) {
      await sendMessage(
        `[PASS] 이번 주 pass는 전부 소진됐다. ${state.weeklyPass.used}/${config.maxWeeklyPasses}`
      );
      return;
    }

    const parts = currentParts();

    if (!isAfterStartTime(parts, config)) {
      await sendMessage('[PASS] pass는 세션이 열린 뒤에만 쓸 수 있다.');
      return;
    }

    if (!state.session || state.session.dateKey !== parts.dateKey) {
      state.session = createWaitingSession(parts, now());
    }

    if (state.session.mode === 'working') {
      await sendMessage('[PASS] 이미 시작한 세션이다. 이제는 pass가 아니라 전진이다.');
      return;
    }

    if (state.session.mode === 'passed') {
      await sendMessage(
        `[PASS] 오늘은 이미 pass 처리됐다. 이번 주 pass ${state.weeklyPass.used}/${config.maxWeeklyPasses}`
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
      config.passMessages[(state.weeklyPass.used - 1) % config.passMessages.length];
    await sendMessage(
      `[PASS] ${message} 이번 주 pass ${state.weeklyPass.used}/${config.maxWeeklyPasses}`
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
