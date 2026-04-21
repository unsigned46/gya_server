const { buildButlerMessages } = require('./personas/butler');
const { buildGigachadMessages } = require('./personas/gigachad');
const { buildYandereMessages } = require('./personas/yandere');

const PERSONAS = {
  basic: buildButlerMessages,
  butler: buildButlerMessages,
  default: buildButlerMessages,
  gigachad: buildGigachadMessages,
  yandere: buildYandereMessages,
};

function formatStartTimeLabel(hour, minute) {
  const period = hour < 12 ? '오전' : '오후';
  const normalizedHour = hour % 12 || 12;
  const minuteText =
    minute === 0 ? '' : ` ${String(minute).padStart(2, '0')}분`;

  return `${period} ${normalizedHour}시${minuteText}`;
}

function normalizePersonaName(persona) {
  return String(persona || 'butler').trim().toLowerCase();
}

function getPersonaBuilder(persona) {
  const personaName = normalizePersonaName(persona);
  const builder = PERSONAS[personaName];

  if (!builder) {
    const supported = Object.keys(PERSONAS).sort().join(', ');
    throw new Error(
      `Unknown MESSAGE_PERSONA: ${persona}. Supported personas: ${supported}`
    );
  }

  return builder;
}

function buildMessages({ startHour, startMinute, persona = 'butler' }) {
  const startTimeLabel = formatStartTimeLabel(startHour, startMinute);
  const buildPersonaMessages = getPersonaBuilder(persona);

  return buildPersonaMessages({ startTimeLabel });
}

function buildPhaseOneMessages(startTimeLabel) {
  return buildButlerMessages({ startTimeLabel }).phaseOneReminders;
}

module.exports = {
  buildMessages,
  buildPhaseOneMessages,
  formatStartTimeLabel,
  getPersonaBuilder,
  normalizePersonaName,
};
