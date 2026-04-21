function buildButlerMessages({ startTimeLabel }) {
  return {
    phaseOneReminders: [
      `[WORK] ${startTimeLabel}입니다. 지금은 시작 신호입니다. 첫 파일만 열어두시죠. /startwork`,
      '[WORK] 아직 시작 전입니다. 생각은 잠시 접고 2분만 착수해보시죠. /startwork',
      '[WORK] 완벽한 준비는 필요 없습니다. 가장 작은 다음 행동 하나면 충분합니다. /startwork',
      '[WORK] 선택지는 작게 두겠습니다: 열기, 적기, 실행하기. 하나만 해보시죠. /startwork',
    ],
    phaseTwoReminders: [
      '[PUSH] 지연이 길어지고 있습니다. 10초 안에 첫 행동을 시작해보시죠. /startwork',
      '[PUSH] 지금은 기분을 설득할 시간이 아니라 환경을 바꿀 시간입니다. 자리를 잡고 /startwork',
      '[PUSH] 저항감은 정상입니다. 그래도 2분만 시작하면 흐름이 생깁니다. /startwork',
      '[PUSH] 오늘의 기준은 완성이 아니라 착수입니다. 바로 /startwork',
      '[PUSH] pass가 아니라면 지금 시작하시는 편이 좋겠습니다. 의식적으로 선택하시죠. /startwork',
    ],
    passMessages: [
      '오늘은 의식적으로 pass 처리합니다. 휴식도 계획 안에 넣고 내일 다시 열겠습니다.',
      '오늘 세션은 건너뜁니다. 다음 세션의 첫 행동을 작게 잡고 다시 시작하겠습니다.',
    ],
    acknowledgement:
      '[OK] 시작 확인했습니다. 이제 목표는 오래 버티기가 아니라 10분만 흐름을 만드는 것입니다.',
    done:
      '[DONE] 오늘 작업 완료로 기록했습니다. 시작보다 더 어려운 마무리까지 해내셨습니다.',
    reset:
      '[RESET] 오늘 세션 상태를 초기화했습니다. 다시 시작 신호를 기다리거나 /forcestart로 열 수 있습니다.',
    help: [
      '[HELP] 사용 가능한 명령어입니다.',
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
      '[SNOOZE] 미룰 수 있는 대기 세션이 없습니다. 필요하면 /forcestart로 열 수 있습니다.',
    snoozeMinutesInvalid:
      '[SNOOZE] 사용법: /snooze 5 처럼 분 단위 숫자를 붙여주세요.',
    snoozed: ({ minutes }) =>
      `[SNOOZE] 알림을 ${minutes}분 뒤로 미뤘습니다. 돌아오면 첫 행동 하나만 하시면 됩니다.`,
    stopForNoStart:
      '[STOP] 15분 동안 시작 확인이 없어 오늘 세션을 닫습니다. 내일은 첫 행동을 더 작게 잡아보시죠.',
    statusNoSession: ({ used, max }) =>
      `[STATUS] 오늘 세션은 아직 열리지 않았습니다. 이번 주 pass ${used}/${max}`,
    statusWorking: ({ dateKey, used, max }) =>
      `[OK] ${dateKey} 세션은 이미 시작됐습니다. 이번 주 pass ${used}/${max}`,
    statusPassed: ({ dateKey, used, max }) =>
      `[PASS] ${dateKey} 오늘은 의식적 pass입니다. 이번 주 pass ${used}/${max}`,
    statusStopped: ({ dateKey, used, max }) =>
      `[STOP] ${dateKey} 오늘 세션은 닫혔습니다. 이번 주 pass ${used}/${max}`,
    statusDone: ({ dateKey, used, max }) =>
      `[DONE] ${dateKey} 오늘 작업은 완료됐습니다. 이번 주 pass ${used}/${max}`,
    statusWaiting: ({ dateKey, elapsedSeconds, used, max }) =>
      `[WAIT] ${dateKey} 아직 시작 전입니다. ${elapsedSeconds}초 지났습니다. 이번 주 pass ${used}/${max}`,
    passLimitReached: ({ used, max }) =>
      `[PASS] 이번 주 pass는 전부 소진됐습니다. ${used}/${max}`,
    passBeforeStart: '[PASS] pass는 세션이 열린 뒤에만 쓸 수 있습니다.',
    passAlreadyWorking:
      '[PASS] 이미 시작한 세션입니다. 지금은 pass가 아니라 흐름을 유지할 시간입니다.',
    passAlreadyUsed: ({ used, max }) =>
      `[PASS] 오늘은 이미 pass 처리됐습니다. 이번 주 pass ${used}/${max}`,
    passUsed: ({ message, used, max }) =>
      `[PASS] ${message} 이번 주 pass ${used}/${max}`,
    doneNoSession:
      '[DONE] 완료할 세션이 아직 없습니다. 먼저 /forcestart 또는 /startwork로 세션을 열어주세요.',
    doneBeforeStart:
      '[DONE] 아직 시작 확인이 없습니다. 완료 전에 /startwork로 시작을 먼저 기록해주세요.',
    doneAlready: '[DONE] 오늘 작업은 이미 완료로 기록되어 있습니다.',
  };
}

module.exports = {
  buildButlerMessages,
};
