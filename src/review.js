const { getWeekKey } = require('./time');

function formatDuration(milliseconds) {
  const totalSeconds = Math.max(0, Math.round(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes === 0) {
    return `${seconds}초`;
  }

  if (seconds === 0) {
    return `${minutes}분`;
  }

  return `${minutes}분 ${seconds}초`;
}

function average(values) {
  if (values.length === 0) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function getEventsForWeek(events, weekKey, timeZone) {
  return events.filter((event) => {
    if (!event || typeof event.occurredAtMs !== 'number') {
      return false;
    }

    return getWeekKey(new Date(event.occurredAtMs), timeZone) === weekKey;
  });
}

function buildWeeklyReview(events, { now = new Date(), timeZone }) {
  const weekKey = getWeekKey(now, timeZone);
  const weekEvents = getEventsForWeek(events, weekKey, timeZone);

  if (weekEvents.length === 0) {
    return `[WEEK] ${weekKey} 주간 기록이 아직 없다. 첫 세션이 열리면 회고가 쌓이기 시작한다.`;
  }

  const openedDays = new Set(
    weekEvents
      .filter((event) => event.type === 'session_opened')
      .map((event) => event.sessionDateKey || event.dateKey)
  );
  const startedEvents = weekEvents.filter(
    (event) => event.type === 'session_started'
  );
  const doneEvents = weekEvents.filter((event) => event.type === 'session_done');
  const passEvents = weekEvents.filter((event) => event.type === 'session_passed');
  const stoppedEvents = weekEvents.filter(
    (event) => event.type === 'session_stopped'
  );
  const reminderEvents = weekEvents.filter(
    (event) => event.type === 'reminder_sent'
  );

  const startElapsedValues = startedEvents
    .map((event) => event.metadata && event.metadata.elapsedMs)
    .filter((value) => typeof value === 'number');
  const workElapsedValues = doneEvents
    .map((event) => event.metadata && event.metadata.workElapsedMs)
    .filter((value) => typeof value === 'number');
  const averageStartMs = average(startElapsedValues);
  const averageWorkMs = average(workElapsedValues);
  const startRate =
    openedDays.size === 0
      ? 0
      : Math.round((startedEvents.length / openedDays.size) * 100);

  const lines = [
    `[WEEK] ${weekKey} 주간 회고`,
    `세션 열린 날: ${openedDays.size}일`,
    `시작: ${startedEvents.length}회 (${startRate}%)`,
    `완료: ${doneEvents.length}회`,
    `pass: ${passEvents.length}회`,
    `stop: ${stoppedEvents.length}회`,
    `알림 발송: ${reminderEvents.length}회`,
  ];

  if (averageStartMs !== null) {
    lines.push(`평균 착수 시간: ${formatDuration(averageStartMs)}`);
  }

  if (averageWorkMs !== null) {
    lines.push(`평균 작업 지속: ${formatDuration(averageWorkMs)}`);
  }

  if (stoppedEvents.length > 0) {
    lines.push('힌트: stop이 나온 날은 첫 행동을 더 작게 쪼개는 게 좋다.');
  } else if (passEvents.length > 0) {
    lines.push('힌트: pass는 실패가 아니라 선택이다. 다만 패턴은 확인하자.');
  } else if (startedEvents.length > 0) {
    lines.push('힌트: 시작 기록이 있다. 이제 /done으로 마무리 기록까지 남기자.');
  }

  return lines.join('\n');
}

function createReviewService({ historyStore, now = () => new Date(), timeZone }) {
  return {
    getWeeklyReviewMessage: () =>
      buildWeeklyReview(historyStore.load().events, {
        now: now(),
        timeZone,
      }),
  };
}

module.exports = {
  buildWeeklyReview,
  createReviewService,
  formatDuration,
  getEventsForWeek,
};
