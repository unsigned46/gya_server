function buildGigachadMessages({ startTimeLabel }) {
  return {
    phaseOneReminders: [
      `[WORK] ${startTimeLabel}. 왕의 시간이다. 첫 파일 열고 바로 들어간다. /startwork`,
      '[WORK] 생각 과다 금지. 2분 착수하는 사람이 결국 이긴다. /startwork',
      '[WORK] 준비가 아니라 실행이 근육이다. 가장 작은 행동 하나. /startwork',
      '[WORK] 열기, 적기, 실행하기. 셋 중 하나만 골라도 이미 전진이다. /startwork',
    ],
    phaseTwoReminders: [
      '[PUSH] 지연이 길다. 10초 안에 움직이면 판이 바뀐다. /startwork',
      '[PUSH] 기분은 나중이다. 환경부터 세팅하고 몸을 움직인다. /startwork',
      '[PUSH] 저항감? 정상이다. 그래도 2분 시작하면 네가 이긴다. /startwork',
      '[PUSH] 오늘 목표는 완벽이 아니다. 착수하는 사람이 강하다. /startwork',
      '[PUSH] pass가 아니라면 지금이다. 선택하고 움직여라. /startwork',
    ],
    passMessages: [
      '오늘은 전략적 pass다. 회복도 훈련이다. 내일 다시 들어간다.',
      '오늘 세션은 접는다. 대신 다음 시작은 더 작고 빠르게 간다.',
    ],
    acknowledgement:
      '[OK] 시작 확인. 좋다. 이제 10분만 밀면 흐름은 네 편이다.',
    done: '[DONE] 완료 기록. 오늘의 너는 약속을 지켰다.',
    reset:
      '[RESET] 세션 초기화 완료. 필요하면 /forcestart로 다시 판을 열어라.',
    help: [
      '[HELP] 커맨드 리스트다.',
      '/startwork - 시작했다고 선언',
      '/status - 현재 상태 확인',
      '/snooze 5 - 5분 뒤 다시 호출',
      '/done - 오늘 작업 완료 기록',
      '/pass - 전략적 pass',
      '/week - 이번 주 성적표',
      '/forcestart - 지금 세션 강제 오픈',
      '/reset - 현재 세션 리셋',
      '/help - 명령어 보기',
    ].join('\n'),
    snoozeNoWaitingSession:
      '[SNOOZE] 미룰 대기 세션이 없다. 필요하면 /forcestart로 새 판을 열어라.',
    snoozeMinutesInvalid:
      '[SNOOZE] 형식은 /snooze 5 다. 1분 이상 숫자로 넣어라.',
    snoozed: ({ minutes }) =>
      `[SNOOZE] ${minutes}분 미뤘다. 돌아오면 변명 없이 첫 행동이다.`,
    stopForNoStart:
      '[STOP] 15분 동안 시작이 없어서 오늘 세션은 닫는다. 내일은 더 작게, 더 빠르게 간다.',
    statusNoSession: ({ used, max }) =>
      `[STATUS] 아직 열린 세션이 없다. 이번 주 pass ${used}/${max}`,
    statusWorking: ({ dateKey, used, max }) =>
      `[OK] ${dateKey} 세션은 이미 시작됐다. 이번 주 pass ${used}/${max}`,
    statusPassed: ({ dateKey, used, max }) =>
      `[PASS] ${dateKey} 전략적 pass 처리됨. 이번 주 pass ${used}/${max}`,
    statusStopped: ({ dateKey, used, max }) =>
      `[STOP] ${dateKey} 세션은 닫혔다. 이번 주 pass ${used}/${max}`,
    statusDone: ({ dateKey, used, max }) =>
      `[DONE] ${dateKey} 작업 완료. 이번 주 pass ${used}/${max}`,
    statusWaiting: ({ dateKey, elapsedSeconds, used, max }) =>
      `[WAIT] ${dateKey} 아직 시작 전. ${elapsedSeconds}초 지났다. 이번 주 pass ${used}/${max}`,
    passLimitReached: ({ used, max }) =>
      `[PASS] 이번 주 pass 전부 사용했다. ${used}/${max}`,
    passBeforeStart: '[PASS] pass는 세션이 열린 뒤에만 쓴다.',
    passAlreadyWorking:
      '[PASS] 이미 시작했다. 지금은 뒤로 빠질 때가 아니라 흐름을 유지할 때다.',
    passAlreadyUsed: ({ used, max }) =>
      `[PASS] 오늘은 이미 pass 처리됐다. 이번 주 pass ${used}/${max}`,
    passUsed: ({ message, used, max }) =>
      `[PASS] ${message} 이번 주 pass ${used}/${max}`,
    doneNoSession:
      '[DONE] 완료할 세션이 없다. 먼저 /forcestart 또는 /startwork로 판을 열어라.',
    doneBeforeStart:
      '[DONE] 아직 시작 기록이 없다. 먼저 /startwork로 시작을 박아라.',
    doneAlready: '[DONE] 이미 완료 기록됐다. 좋다.',
  };
}

module.exports = {
  buildGigachadMessages,
};
