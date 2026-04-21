function formatStartTimeLabel(hour, minute) {
  const period = hour < 12 ? '오전' : '오후';
  const normalizedHour = hour % 12 || 12;
  const minuteText =
    minute === 0 ? '' : ` ${String(minute).padStart(2, '0')}분`;

  return `${period} ${normalizedHour}시${minuteText}`;
}

function buildPhaseOneMessages(startTimeLabel) {
  return [
    `[WORK] ${startTimeLabel}이다. 지금은 시작 신호다. 첫 파일만 열자. /startwork`,
    '[WORK] 아직 시작 전이다. 생각을 줄이고 2분만 착수하자. /startwork',
    '[WORK] 완벽한 준비는 필요 없다. 가장 작은 다음 행동 하나만 하자. /startwork',
    '[WORK] 선택지는 작게: 열기, 적기, 실행하기. 하나 하고 /startwork',
  ];
}

const PHASE_TWO_MESSAGES = [
  '[PUSH] 지연이 길어지고 있다. 10초 안에 첫 행동을 시작하자. /startwork',
  '[PUSH] 지금은 기분을 설득할 시간이 아니라 환경을 바꿀 시간이다. 자리 잡고 /startwork',
  '[PUSH] 저항감은 정상이다. 그래도 2분만 시작하면 흐름이 생긴다. /startwork',
  '[PUSH] 오늘의 기준은 완성이 아니라 착수다. 바로 /startwork',
  '[PUSH] pass가 아니라면 지금 시작하자. 의식적으로 선택하자. /startwork',
];

const PASS_MESSAGES = [
  '오늘은 의식적으로 pass 처리한다. 휴식도 계획 안에 넣고 내일 다시 연다.',
  '오늘 세션은 건너뛴다. 다음 세션의 첫 행동을 작게 잡고 다시 시작한다.',
];

function buildMessages({ startHour, startMinute }) {
  const startTimeLabel = formatStartTimeLabel(startHour, startMinute);

  return {
    phaseOneReminders: buildPhaseOneMessages(startTimeLabel),
    phaseTwoReminders: PHASE_TWO_MESSAGES,
    passMessages: PASS_MESSAGES,
    acknowledgement:
      '[OK] 시작 확인. 이제 목표는 오래 버티기가 아니라 10분만 흐름 만들기다.',
    done:
      '[DONE] 오늘 작업 완료로 기록했다. 시작보다 더 어려운 마무리까지 했다.',
    reset:
      '[RESET] 오늘 세션 상태를 초기화했다. 다시 시작 신호를 기다리거나 /forcestart로 열 수 있다.',
    help: [
      '[HELP] 사용 가능한 명령어',
      '/startwork - 오늘 작업 시작 확인',
      '/status - 현재 세션 상태 확인',
      '/snooze 5 - 5분 뒤 다시 알림',
      '/done - 오늘 작업 완료 기록',
      '/pass - 오늘 세션을 의식적으로 건너뜀',
      '/week - 이번 주 회고 보기',
      '/forcestart - 지금 세션 강제 시작',
      '/reset - 현재 세션 상태 초기화',
      '/help - 명령어 목록 보기',
    ].join('\n'),
    snoozeNoWaitingSession:
      '[SNOOZE] 미룰 수 있는 대기 세션이 없다. 필요하면 /forcestart로 열 수 있다.',
    snoozeMinutesInvalid:
      '[SNOOZE] 사용법: /snooze 5 처럼 분 단위 숫자를 붙여줘.',
    snoozed: ({ minutes }) =>
      `[SNOOZE] 알림을 ${minutes}분 뒤로 미뤘다. 다시 돌아올 때는 첫 행동 하나만 하면 된다.`,
    stopForNoStart:
      '[STOP] 15분 동안 시작 확인이 없어 오늘 세션을 닫는다. 내일은 첫 행동을 더 작게 잡자.',
    statusNoSession: ({ used, max }) =>
      `[STATUS] 오늘 세션은 아직 열리지 않았다. 이번 주 pass ${used}/${max}`,
    statusWorking: ({ dateKey, used, max }) =>
      `[OK] ${dateKey} 세션은 이미 시작됐다. 이번 주 pass ${used}/${max}`,
    statusPassed: ({ dateKey, used, max }) =>
      `[PASS] ${dateKey} 오늘은 의식적 pass다. 이번 주 pass ${used}/${max}`,
    statusStopped: ({ dateKey, used, max }) =>
      `[STOP] ${dateKey} 오늘 세션은 닫혔다. 이번 주 pass ${used}/${max}`,
    statusDone: ({ dateKey, used, max }) =>
      `[DONE] ${dateKey} 오늘 작업은 완료됐다. 이번 주 pass ${used}/${max}`,
    statusWaiting: ({ dateKey, elapsedSeconds, used, max }) =>
      `[WAIT] ${dateKey} 아직 시작 전이다. ${elapsedSeconds}초 지났다. 이번 주 pass ${used}/${max}`,
    passLimitReached: ({ used, max }) =>
      `[PASS] 이번 주 pass는 전부 소진됐다. ${used}/${max}`,
    passBeforeStart: '[PASS] pass는 세션이 열린 뒤에만 쓸 수 있다.',
    passAlreadyWorking:
      '[PASS] 이미 시작한 세션이다. 지금은 pass가 아니라 흐름을 유지할 시간이다.',
    passAlreadyUsed: ({ used, max }) =>
      `[PASS] 오늘은 이미 pass 처리됐다. 이번 주 pass ${used}/${max}`,
    passUsed: ({ message, used, max }) =>
      `[PASS] ${message} 이번 주 pass ${used}/${max}`,
    doneNoSession:
      '[DONE] 완료할 세션이 아직 없다. 먼저 /forcestart 또는 /startwork로 세션을 열자.',
    doneBeforeStart:
      '[DONE] 아직 시작 확인이 없다. 완료 전에 /startwork로 시작을 먼저 기록하자.',
    doneAlready:
      '[DONE] 오늘 작업은 이미 완료로 기록되어 있다.',
  };
}

module.exports = {
  buildMessages,
  buildPhaseOneMessages,
  formatStartTimeLabel,
};
