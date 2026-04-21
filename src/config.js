const fs = require('fs');
const path = require('path');

const KST_TIME_ZONE = 'Asia/Seoul';

const DEFAULTS = {
  pollIntervalMs: 3000,
  schedulerIntervalMs: 1000,
  startHour: 20,
  startMinute: 0,
  phaseOneIntervalMinutes: 1,
  escalationAfterMinutes: 5,
  giveUpAfterMinutes: 10,
  emergencyMinIntervalSeconds: 1,
  emergencyMaxIntervalSeconds: 10,
  maxWeeklyPasses: 5,
};

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

function formatStartTimeLabel(hour, minute) {
  const period = hour < 12 ? '오전' : '오후';
  const normalizedHour = hour % 12 || 12;
  const minuteText =
    minute === 0 ? '' : ` ${String(minute).padStart(2, '0')}분`;

  return `${period} ${normalizedHour}시${minuteText}`;
}

function buildPhaseOneMessages(startTimeLabel) {
  return [
    `[WORK] ${startTimeLabel}이다. 시작 시간이다. /startwork`,
    `[WORK] ${startTimeLabel}인데 아직 시작 전이다. /startwork`,
    `[WORK] ${startTimeLabel}다. 바로 착수해라. /startwork`,
    `[WORK] ${startTimeLabel}다. 지체하지 마라. /startwork`,
  ];
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
  const startTimeLabel = formatStartTimeLabel(startHour, startMinute);

  return {
    token: env.TELEGRAM_BOT_TOKEN,
    chatId: env.TELEGRAM_CHAT_ID,
    timeZone: KST_TIME_ZONE,
    pollIntervalMs: DEFAULTS.pollIntervalMs,
    schedulerIntervalMs: DEFAULTS.schedulerIntervalMs,
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
    emergencyMinIntervalMs:
      parseEnvNumber(
        'EMERGENCY_MIN_INTERVAL_SECONDS',
        DEFAULTS.emergencyMinIntervalSeconds,
        env
      ) * 1000,
    emergencyMaxIntervalMs:
      parseEnvNumber(
        'EMERGENCY_MAX_INTERVAL_SECONDS',
        DEFAULTS.emergencyMaxIntervalSeconds,
        env
      ) * 1000,
    maxWeeklyPasses: parseEnvNumber(
      'MAX_WEEKLY_PASSES',
      DEFAULTS.maxWeeklyPasses,
      env
    ),
    phaseOneMessages: buildPhaseOneMessages(startTimeLabel),
    phaseTwoMessages: PHASE_TWO_MESSAGES,
    passMessages: PASS_MESSAGES,
    disappointmentMessage: DISAPPOINTMENT_MESSAGE,
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
