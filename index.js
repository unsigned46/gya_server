const https = require('https');
const fs = require('fs');
const path = require('path');

const ENV_FILE = path.join(__dirname, '.env');
const STATE_FILE = path.join(__dirname, 'state.json');
const KST_TIME_ZONE = 'Asia/Seoul';
const POLL_INTERVAL_MS = 3000;
const SCHEDULER_INTERVAL_MS = 1000;
const DEFAULT_START_HOUR = 20;
const DEFAULT_START_MINUTE = 0;
const DEFAULT_PHASE_ONE_INTERVAL_MINUTES = 1;
const DEFAULT_ESCALATION_AFTER_MINUTES = 5;
const DEFAULT_GIVE_UP_AFTER_MINUTES = 10;
const DEFAULT_EMERGENCY_MIN_INTERVAL_SECONDS = 1;
const DEFAULT_EMERGENCY_MAX_INTERVAL_SECONDS = 10;
const DEFAULT_MAX_WEEKLY_PASSES = 5;

const PHASE_TWO_MESSAGES = [
  '[PUSH] 지연 중이다. /startwork',
  '[PUSH] 아직 시작하지 않았다. /startwork',
  '[PUSH] 예정 시각은 지났다. /startwork',
  '[PUSH] 확인 말고 시작. /startwork',
  '[PUSH] 계속 미루는 중이다. /startwork',
  '[PUSH] 지금 착수. /startwork',
];

const PASS_MESSAGES = [
  '오늘은 pass 처리한다. 내일 다시 시작한다.',
  '오늘 세션은 건너뛴다. 다음 세션에 바로 들어간다.',
];

const DISAPPOINTMENT_MESSAGE =
  '[STOP] 10분이 지났고 시작도 없었다. 실망스럽다. 오늘 세션은 종료한다.';

loadEnvFile();

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const START_HOUR = parseEnvNumber('START_HOUR', DEFAULT_START_HOUR);
const START_MINUTE = parseEnvNumber('START_MINUTE', DEFAULT_START_MINUTE);
const PHASE_ONE_INTERVAL_MS =
  parseEnvNumber(
    'PHASE_ONE_INTERVAL_MINUTES',
    DEFAULT_PHASE_ONE_INTERVAL_MINUTES
  ) * 60 * 1000;
const ESCALATION_AFTER_MS =
  parseEnvNumber(
    'ESCALATION_AFTER_MINUTES',
    DEFAULT_ESCALATION_AFTER_MINUTES
  ) * 60 * 1000;
const GIVE_UP_AFTER_MS =
  parseEnvNumber('GIVE_UP_AFTER_MINUTES', DEFAULT_GIVE_UP_AFTER_MINUTES) *
  60 *
  1000;
const EMERGENCY_MIN_INTERVAL_MS =
  parseEnvNumber(
    'EMERGENCY_MIN_INTERVAL_SECONDS',
    DEFAULT_EMERGENCY_MIN_INTERVAL_SECONDS
  ) * 1000;
const EMERGENCY_MAX_INTERVAL_MS =
  parseEnvNumber(
    'EMERGENCY_MAX_INTERVAL_SECONDS',
    DEFAULT_EMERGENCY_MAX_INTERVAL_SECONDS
  ) * 1000;
const MAX_WEEKLY_PASSES = parseEnvNumber(
  'MAX_WEEKLY_PASSES',
  DEFAULT_MAX_WEEKLY_PASSES
);

const START_TIME_LABEL = formatStartTimeLabel(START_HOUR, START_MINUTE);
const PHASE_ONE_MESSAGES = [
  `[WORK] ${START_TIME_LABEL}다. 시작 시간이다. /startwork`,
  `[WORK] ${START_TIME_LABEL}인데 아직 시작 전이다. /startwork`,
  `[WORK] ${START_TIME_LABEL}다. 바로 착수해라. /startwork`,
  `[WORK] ${START_TIME_LABEL}다. 지체하지 마라. /startwork`,
];

if (!TOKEN || !CHAT_ID) {
  throw new Error('Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID in .env');
}

function parseEnvNumber(key, fallbackValue) {
  const rawValue = process.env[key];

  if (rawValue === undefined || rawValue === '') {
    return fallbackValue;
  }

  const parsedValue = Number(rawValue);

  if (!Number.isFinite(parsedValue)) {
    throw new Error(`Invalid numeric value for ${key}: ${rawValue}`);
  }

  return parsedValue;
}

function formatStartTimeLabel(hour, minute) {
  const period = hour < 12 ? '오전' : '오후';
  const normalizedHour = hour % 12 || 12;
  const minuteText =
    minute === 0 ? '' : ` ${String(minute).padStart(2, '0')}분`;

  return `${period} ${normalizedHour}시${minuteText}`;
}

function loadEnvFile() {
  if (!fs.existsSync(ENV_FILE)) {
    return;
  }

  const lines = fs.readFileSync(ENV_FILE, 'utf-8').split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function createDefaultState() {
  return {
    lastUpdateId: 0,
    session: null,
    weeklyPass: {
      weekKey: '',
      used: 0,
    },
  };
}

function loadState() {
  try {
    const raw = fs.readFileSync(STATE_FILE, 'utf-8');
    const parsed = JSON.parse(raw);

    return {
      ...createDefaultState(),
      ...parsed,
    };
  } catch {
    return createDefaultState();
  }
}

function saveState(currentState) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(currentState, null, 2), 'utf-8');
}

let state = loadState();
let isPolling = false;
let isSendingReminder = false;

function telegramGet(pathname) {
  return new Promise((resolve, reject) => {
    const request = https.request(
      {
        hostname: 'api.telegram.org',
        path: `/bot${TOKEN}/${pathname}`,
        method: 'GET',
        family: 4,
        timeout: 15000,
      },
      (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);

            if (!parsed.ok) {
              reject(new Error(`Telegram API error: ${data}`));
              return;
            }

            resolve(parsed.result);
          } catch (error) {
            reject(error);
          }
        });
      }
    );

    request.on('timeout', () => {
      request.destroy(new Error('Telegram request timed out after 15000ms'));
    });

    request.on('error', reject);
    request.end();
  });
}

function sendMessage(text) {
  const encoded = encodeURIComponent(text);
  return telegramGet(`sendMessage?chat_id=${CHAT_ID}&text=${encoded}`);
}

function getKstParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: KST_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const map = {};

  for (const part of parts) {
    if (part.type !== 'literal') {
      map[part.type] = part.value;
    }
  }

  return {
    dateKey: `${map.year}-${map.month}-${map.day}`,
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
    displayTime: `${map.year}-${map.month}-${map.day} ${map.hour}:${map.minute}:${map.second}`,
  };
}

function getWeekKey(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: KST_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  });

  const parts = formatter.formatToParts(date);
  const map = {};

  for (const part of parts) {
    if (part.type !== 'literal') {
      map[part.type] = part.value;
    }
  }

  const weekdayMap = {
    Mon: 0,
    Tue: 1,
    Wed: 2,
    Thu: 3,
    Fri: 4,
    Sat: 5,
    Sun: 6,
  };

  const utcMidnightMs = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day)
  );
  const dayOffset = weekdayMap[map.weekday] ?? 0;
  const mondayMs = utcMidnightMs - dayOffset * 24 * 60 * 60 * 1000;
  const mondayDate = new Date(mondayMs);
  const mondayYear = mondayDate.getUTCFullYear();
  const mondayMonth = String(mondayDate.getUTCMonth() + 1).padStart(2, '0');
  const mondayDay = String(mondayDate.getUTCDate()).padStart(2, '0');

  return `${mondayYear}-${mondayMonth}-${mondayDay}`;
}

function ensureWeeklyPassState() {
  const weekKey = getWeekKey();

  if (!state.weeklyPass || state.weeklyPass.weekKey !== weekKey) {
    state.weeklyPass = {
      weekKey,
      used: 0,
    };
  }
}

function getElapsedMs(session, now = Date.now()) {
  return Math.max(0, now - session.startedAtMs);
}

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getNextReminderDelay(elapsedMs) {
  if (elapsedMs >= ESCALATION_AFTER_MS) {
    return getRandomInt(EMERGENCY_MIN_INTERVAL_MS, EMERGENCY_MAX_INTERVAL_MS);
  }

  return PHASE_ONE_INTERVAL_MS;
}

function getReminderText(elapsedMs, reminderCount) {
  if (elapsedMs >= ESCALATION_AFTER_MS) {
    return PHASE_TWO_MESSAGES[reminderCount % PHASE_TWO_MESSAGES.length];
  }

  return PHASE_ONE_MESSAGES[reminderCount % PHASE_ONE_MESSAGES.length];
}

function createWaitingSession(parts) {
  return {
    dateKey: parts.dateKey,
    startedAtMs: Date.now(),
    acknowledgedAtMs: null,
    lastReminderAtMs: 0,
    nextReminderAtMs: 0,
    reminderCount: 0,
    stoppedAtMs: null,
    stopReason: null,
    mode: 'waiting',
  };
}

async function startDailySession(parts) {
  ensureWeeklyPassState();
  state.session = createWaitingSession(parts);

  saveState(state);
  await sendReminder(true);
}

async function forceStartSession() {
  const parts = getKstParts();
  state.session = createWaitingSession(parts);
  saveState(state);
  await sendReminder(true);
}

async function sendReminder(force = false) {
  if (!state.session || state.session.mode !== 'waiting' || isSendingReminder) {
    return;
  }

  const now = Date.now();
  const elapsedMs = getElapsedMs(state.session, now);

  if (elapsedMs >= GIVE_UP_AFTER_MS) {
    await stopSessionForNoStart();
    return;
  }

  const due =
    force ||
    !state.session.nextReminderAtMs ||
    now >= state.session.nextReminderAtMs;

  if (!due) {
    return;
  }

  isSendingReminder = true;

  try {
    await sendMessage(
      getReminderText(elapsedMs, state.session.reminderCount || 0)
    );
    state.session.lastReminderAtMs = now;
    state.session.reminderCount = (state.session.reminderCount || 0) + 1;
    state.session.nextReminderAtMs = now + getNextReminderDelay(elapsedMs);
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
  state.session.stoppedAtMs = Date.now();
  state.session.stopReason = 'missed';
  state.session.nextReminderAtMs = null;
  saveState(state);

  await sendMessage(DISAPPOINTMENT_MESSAGE);
}

async function acknowledgeStart() {
  const now = Date.now();

  if (!state.session) {
    const parts = getKstParts();
    state.session = createWaitingSession(parts);
    state.session.lastReminderAtMs = now;
  } else {
    state.session.acknowledgedAtMs = now;
  }

  state.session.acknowledgedAtMs = now;
  state.session.mode = 'working';
  state.session.stopReason = null;
  state.session.stoppedAtMs = null;
  state.session.nextReminderAtMs = null;
  saveState(state);
  await sendMessage('[OK] 좋다. 이제 작업 모드다. 집중해서 밀어붙여라.');
}

function getStatusMessage() {
  ensureWeeklyPassState();

  if (!state.session) {
    return `[STATUS] 오늘 세션은 아직 열리지 않았다. 이번 주 pass ${state.weeklyPass.used}/${MAX_WEEKLY_PASSES}`;
  }

  if (state.session.acknowledgedAtMs) {
    return `[OK] ${state.session.dateKey} 세션은 이미 시작됐다. 이번 주 pass ${state.weeklyPass.used}/${MAX_WEEKLY_PASSES}`;
  }

  if (state.session.mode === 'passed') {
    return `[PASS] ${state.session.dateKey} 오늘은 전략적 pass다. 이번 주 pass ${state.weeklyPass.used}/${MAX_WEEKLY_PASSES}`;
  }

  if (state.session.mode === 'stopped') {
    return `[STOP] ${state.session.dateKey} 오늘 세션은 종료됐다. 이번 주 pass ${state.weeklyPass.used}/${MAX_WEEKLY_PASSES}`;
  }

  const elapsedSeconds = Math.floor(getElapsedMs(state.session) / 1000);
  return `[WAIT] ${state.session.dateKey} 아직 시작 전이다. ${elapsedSeconds}초 지났다. 이번 주 pass ${state.weeklyPass.used}/${MAX_WEEKLY_PASSES}`;
}

async function resetSession() {
  state.session = null;
  saveState(state);
  await sendMessage('[RESET] 오늘 세션 상태를 초기화했다. 다시 제대로 시작하면 된다.');
}

async function usePass() {
  ensureWeeklyPassState();

  if (state.weeklyPass.used >= MAX_WEEKLY_PASSES) {
    await sendMessage(
      `[PASS] 이번 주 pass는 전부 소진됐다. ${state.weeklyPass.used}/${MAX_WEEKLY_PASSES}`
    );
    return;
  }

  const parts = getKstParts();
  const isAfterStartTime =
    parts.hour > START_HOUR ||
    (parts.hour === START_HOUR && parts.minute >= START_MINUTE);

  if (!isAfterStartTime) {
    await sendMessage('[PASS] pass는 세션이 열린 뒤에만 쓸 수 있다.');
    return;
  }

  if (!state.session || state.session.dateKey !== parts.dateKey) {
    state.session = createWaitingSession(parts);
  }

  if (state.session.mode === 'working') {
    await sendMessage('[PASS] 이미 시작한 세션이다. 이제는 pass가 아니라 전진이다.');
    return;
  }

  if (state.session.mode === 'passed') {
    await sendMessage(
      `[PASS] 오늘은 이미 pass 처리됐다. 이번 주 pass ${state.weeklyPass.used}/${MAX_WEEKLY_PASSES}`
    );
    return;
  }

  state.weeklyPass.used += 1;
  state.session.mode = 'passed';
  state.session.stoppedAtMs = Date.now();
  state.session.stopReason = 'pass';
  state.session.nextReminderAtMs = null;
  saveState(state);

  const message =
    PASS_MESSAGES[(state.weeklyPass.used - 1) % PASS_MESSAGES.length];
  await sendMessage(
    `[PASS] ${message} 이번 주 pass ${state.weeklyPass.used}/${MAX_WEEKLY_PASSES}`
  );
}

async function handleCommand(text) {
  if (text === '/forcestart') {
    await forceStartSession();
    return;
  }

  if (text === '/startwork' || text === '/ack' || text === '/start') {
    await acknowledgeStart();
    return;
  }

  if (text === '/status') {
    await sendMessage(getStatusMessage());
    return;
  }

  if (text === '/reset') {
    await resetSession();
    return;
  }

  if (text === '/pass') {
    await usePass();
    return;
  }

  if (text === '/help') {
    await sendMessage(
      '명령어: /startwork, /forcestart, /pass, /status, /reset'
    );
  }
}

async function pollUpdates() {
  if (isPolling) {
    return;
  }

  isPolling = true;

  try {
    const offset = state.lastUpdateId + 1;
    const updates = await telegramGet(`getUpdates?timeout=0&offset=${offset}`);

    if (!Array.isArray(updates) || updates.length === 0) {
      return;
    }

    for (const update of updates) {
      state.lastUpdateId = update.update_id;

      const message = update.message;
      if (!message || !message.text) {
        continue;
      }

      if (String(message.chat.id) !== String(CHAT_ID)) {
        continue;
      }

      await handleCommand(message.text.trim());
    }

    saveState(state);
  } catch (error) {
    console.error('pollUpdates error:', error.message);
  } finally {
    isPolling = false;
  }
}

async function tickScheduler() {
  ensureWeeklyPassState();

  const parts = getKstParts();
  const isAfterStartTime =
    parts.hour > START_HOUR ||
    (parts.hour === START_HOUR && parts.minute >= START_MINUTE);

  if (
    isAfterStartTime &&
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

console.log(`[boot] scheduler started at KST ${getKstParts().displayTime}`);

setInterval(() => {
  pollUpdates().catch((error) => {
    console.error('poll loop error:', error.message);
  });
}, POLL_INTERVAL_MS);

setInterval(() => {
  tickScheduler().catch((error) => {
    console.error('scheduler error:', error.message);
  });
}, SCHEDULER_INTERVAL_MS);

pollUpdates().catch((error) => {
  console.error('initial poll error:', error.message);
});

tickScheduler().catch((error) => {
  console.error('initial scheduler error:', error.message);
});
