const https = require('https');
const fs = require('fs');
const path = require('path');

const ENV_FILE = path.join(__dirname, '.env');
const STATE_FILE = path.join(__dirname, 'state.json');
const KST_TIME_ZONE = 'Asia/Seoul';
const START_HOUR = 20;
const START_MINUTE = 0;
const POLL_INTERVAL_MS = 3000;
const SCHEDULER_INTERVAL_MS = 1000;
const REMINDER_INTERVAL_MS = 60 * 1000;
const ESCALATION_AFTER_MS = 5 * 60 * 1000;
const EMERGENCY_INTERVAL_MS = 1000;

loadEnvFile();

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

if (!TOKEN || !CHAT_ID) {
  throw new Error('Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID in .env');
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

function getElapsedMs(session, now = Date.now()) {
  return Math.max(0, now - session.startedAtMs);
}

function getReminderInterval(elapsedMs) {
  if (elapsedMs >= ESCALATION_AFTER_MS) {
    return EMERGENCY_INTERVAL_MS;
  }

  return REMINDER_INTERVAL_MS;
}

function getReminderText(elapsedMs) {
  if (elapsedMs >= ESCALATION_AFTER_MS) {
    return '[EMERGENCY] 5분이 지났습니다. 지금 바로 텔레그램에 /startwork 를 보내고 작업을 시작하세요.';
  }

  return '[WORK] 오후 8시입니다. 작업 시작할 시간입니다. 확인했으면 /startwork 를 보내세요.';
}

async function startDailySession(parts) {
  state.session = {
    dateKey: parts.dateKey,
    startedAtMs: Date.now(),
    acknowledgedAtMs: null,
    lastReminderAtMs: 0,
    mode: 'waiting',
  };

  saveState(state);
  await sendReminder(true);
}

async function sendReminder(force = false) {
  if (!state.session || state.session.acknowledgedAtMs || isSendingReminder) {
    return;
  }

  const now = Date.now();
  const elapsedMs = getElapsedMs(state.session, now);
  const intervalMs = getReminderInterval(elapsedMs);
  const due =
    force ||
    !state.session.lastReminderAtMs ||
    now - state.session.lastReminderAtMs >= intervalMs;

  if (!due) {
    return;
  }

  isSendingReminder = true;

  try {
    await sendMessage(getReminderText(elapsedMs));
    state.session.lastReminderAtMs = now;
    saveState(state);
  } catch (error) {
    console.error('sendReminder error:', error.message);
  } finally {
    isSendingReminder = false;
  }
}

async function acknowledgeStart() {
  const now = Date.now();

  if (!state.session) {
    const parts = getKstParts();
    state.session = {
      dateKey: parts.dateKey,
      startedAtMs: now,
      acknowledgedAtMs: now,
      lastReminderAtMs: now,
      mode: 'working',
    };
  } else {
    state.session.acknowledgedAtMs = now;
    state.session.mode = 'working';
  }

  saveState(state);
  await sendMessage('[OK] 작업 시작 확인 완료. 이제 작업 모드로 들어갑니다.');
}

function getStatusMessage() {
  if (!state.session) {
    return '오늘 작업 세션이 아직 시작되지 않았습니다.';
  }

  if (state.session.acknowledgedAtMs) {
    return `[OK] ${state.session.dateKey} 작업 시작 확인이 완료되었습니다.`;
  }

  const elapsedSeconds = Math.floor(getElapsedMs(state.session) / 1000);
  return `[WAIT] ${state.session.dateKey} 작업 시작 대기 중입니다. 시작 후 ${elapsedSeconds}초 지났습니다.`;
}

async function resetSession() {
  state.session = null;
  saveState(state);
  await sendMessage('[RESET] 오늘 작업 세션 상태를 초기화했습니다.');
}

async function handleCommand(text) {
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

  if (text === '/help') {
    await sendMessage('사용 가능한 명령어: /startwork, /status, /reset');
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
    !state.session.acknowledgedAtMs
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
