const fs = require('fs');
const path = require('path');

const {
  buildMessages,
  buildPhaseOneMessages,
  formatStartTimeLabel,
} = require('./messages');

const KST_TIME_ZONE = 'Asia/Seoul';

const DEFAULTS = {
  pollIntervalMs: 3000,
  schedulerIntervalMs: 1000,
  startHour: 20,
  startMinute: 0,
  phaseOneIntervalMinutes: 2,
  escalationAfterMinutes: 6,
  giveUpAfterMinutes: 15,
  phaseTwoIntervalSeconds: 180,
  maxWeeklyPasses: 5,
  defaultSnoozeMinutes: 5,
  maxSnoozeMinutes: 60,
  messagePersona: 'butler',
};

function loadEnvFile(envFile = path.join(__dirname, '..', '.env'), env = process.env) {
  if (!fs.existsSync(envFile)) {
    return;
  }

  const lines = fs.readFileSync(envFile, 'utf-8').split(/\r?\n/);

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

    if (key && env[key] === undefined) {
      env[key] = value;
    }
  }
}

function parseEnvNumber(key, fallbackValue, env = process.env) {
  const rawValue = env[key];

  if (rawValue === undefined || rawValue === '') {
    return fallbackValue;
  }

  const parsedValue = Number(rawValue);

  if (!Number.isFinite(parsedValue)) {
    throw new Error(`Invalid numeric value for ${key}: ${rawValue}`);
  }

  return parsedValue;
}

function buildConfig({
  env = process.env,
  envFile = path.join(__dirname, '..', '.env'),
  shouldLoadEnvFile = true,
} = {}) {
  if (shouldLoadEnvFile) {
    loadEnvFile(envFile, env);
  }

  const startHour = parseEnvNumber('START_HOUR', DEFAULTS.startHour, env);
  const startMinute = parseEnvNumber(
    'START_MINUTE',
    DEFAULTS.startMinute,
    env
  );
  const messagePersona = env.MESSAGE_PERSONA || DEFAULTS.messagePersona;
  const messages = buildMessages({
    persona: messagePersona,
    startHour,
    startMinute,
  });

  return {
    token: env.TELEGRAM_BOT_TOKEN,
    chatId: env.TELEGRAM_CHAT_ID,
    timeZone: KST_TIME_ZONE,
    pollIntervalMs: DEFAULTS.pollIntervalMs,
    schedulerIntervalMs: DEFAULTS.schedulerIntervalMs,
    messagePersona,
    startHour,
    startMinute,
    phaseOneIntervalMs:
      parseEnvNumber(
        'PHASE_ONE_INTERVAL_MINUTES',
        DEFAULTS.phaseOneIntervalMinutes,
        env
      ) *
      60 *
      1000,
    escalationAfterMs:
      parseEnvNumber(
        'ESCALATION_AFTER_MINUTES',
        DEFAULTS.escalationAfterMinutes,
        env
      ) *
      60 *
      1000,
    giveUpAfterMs:
      parseEnvNumber(
        'GIVE_UP_AFTER_MINUTES',
        DEFAULTS.giveUpAfterMinutes,
        env
      ) *
      60 *
      1000,
    phaseTwoIntervalMs:
      parseEnvNumber(
        'PHASE_TWO_INTERVAL_SECONDS',
        DEFAULTS.phaseTwoIntervalSeconds,
        env
      ) * 1000,
    maxWeeklyPasses: parseEnvNumber(
      'MAX_WEEKLY_PASSES',
      DEFAULTS.maxWeeklyPasses,
      env
    ),
    defaultSnoozeMinutes: parseEnvNumber(
      'DEFAULT_SNOOZE_MINUTES',
      DEFAULTS.defaultSnoozeMinutes,
      env
    ),
    maxSnoozeMinutes: parseEnvNumber(
      'MAX_SNOOZE_MINUTES',
      DEFAULTS.maxSnoozeMinutes,
      env
    ),
    messages,
    phaseOneMessages: messages.phaseOneReminders,
    phaseTwoMessages: messages.phaseTwoReminders,
    passMessages: messages.passMessages,
    disappointmentMessage: messages.stopForNoStart,
  };
}

function validateConfig(config) {
  if (!config.token || !config.chatId) {
    throw new Error('Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID in .env');
  }
}

module.exports = {
  buildConfig,
  buildPhaseOneMessages,
  formatStartTimeLabel,
  loadEnvFile,
  parseEnvNumber,
  validateConfig,
};
