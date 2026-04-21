const KST_TIME_ZONE = 'Asia/Seoul';

function getKstParts(date = new Date(), timeZone = KST_TIME_ZONE) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
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

function getWeekKey(date = new Date(), timeZone = KST_TIME_ZONE) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
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

module.exports = {
  getKstParts,
  getWeekKey,
};
