function buildYandereMessages({ startTimeLabel }) {
  return {
    phaseOneReminders: [
      `[WORK] ${startTimeLabel}이야. 나 여기서 보고 있어. 첫 파일만 열어줘. /startwork`,
      '[WORK] 아직 시작 안 했네? 괜찮아, 도망가지만 않으면 돼. 2분만 같이 하자. /startwork',
      '[WORK] 완벽하지 않아도 좋아. 네가 첫 행동만 해주면 나는 만족해. /startwork',
      '[WORK] 열기, 적기, 실행하기. 하나만 골라줘. 내가 끝까지 기억할게. /startwork',
    ],
    phaseTwoReminders: [
      '[PUSH] 지연이 길어지고 있어. 나 기다리는 거 잘하지만, 지금 10초 안에 시작해줘. /startwork',
      '[PUSH] 기분이 널 붙잡아도 괜찮아. 나는 네 편이니까 자리만 잡자. /startwork',
      '[PUSH] 저항감이 있어도 좋아. 2분만 시작하면 내가 계속 지켜봐줄게. /startwork',
      '[PUSH] 오늘은 완성이 아니라 착수만 내게 보여줘. 바로 /startwork',
      '[PUSH] pass할 거면 말해줘. 아니면 지금 나랑 시작하는 거야. /startwork',
    ],
    passMessages: [
      '오늘은 의식적으로 pass 처리할게. 대신 내일은 다시 만나야 해.',
      '오늘 세션은 건너뛸게. 다음 세션의 첫 행동, 내가 기억하고 있을게.',
    ],
    acknowledgement:
      '[OK] 시작했구나. 좋아. 이제 10분만 나랑 같이 있자.',
    done:
      '[DONE] 오늘 작업 완료로 기록했어. 역시 해낼 줄 알았어. 내가 다 기억해둘게.',
    reset:
      '[RESET] 오늘 세션 상태를 초기화했어. 다시 부르면 바로 곁에 있을게.',
    help: [
      '[HELP] 네가 부를 수 있는 명령어야.',
      '/startwork - 시작했다고 알려주기',
      '/status - 지금 상태 확인',
      '/snooze 5 - 5분 뒤 다시 불러달라고 하기',
      '/done - 오늘 작업 완료 기록',
      '/pass - 오늘은 의식적으로 건너뛰기',
      '/week - 이번 주를 같이 돌아보기',
      '/forcestart - 지금 세션 열기',
      '/reset - 현재 세션 초기화',
      '/help - 명령어 다시 보기',
    ].join('\n'),
    snoozeNoWaitingSession:
      '[SNOOZE] 지금 미룰 대기 세션은 없어. 필요하면 /forcestart로 나를 불러.',
    snoozeMinutesInvalid:
      '[SNOOZE] /snooze 5 처럼 숫자로 말해줘. 그래야 내가 정확히 기다리지.',
    snoozed: ({ minutes }) =>
      `[SNOOZE] ${minutes}분 뒤에 다시 올게. 그때는 첫 행동 하나만 보여줘.`,
    stopForNoStart:
      '[STOP] 15분 동안 시작 확인이 없어서 오늘 세션은 닫을게. 내일은 더 작은 첫 행동으로 다시 만나자.',
    statusNoSession: ({ used, max }) =>
      `[STATUS] 오늘 세션은 아직 열리지 않았어. 이번 주 pass ${used}/${max}`,
    statusWorking: ({ dateKey, used, max }) =>
      `[OK] ${dateKey} 세션은 이미 시작됐어. 이번 주 pass ${used}/${max}`,
    statusPassed: ({ dateKey, used, max }) =>
      `[PASS] ${dateKey} 오늘은 의식적 pass야. 이번 주 pass ${used}/${max}`,
    statusStopped: ({ dateKey, used, max }) =>
      `[STOP] ${dateKey} 오늘 세션은 닫혔어. 이번 주 pass ${used}/${max}`,
    statusDone: ({ dateKey, used, max }) =>
      `[DONE] ${dateKey} 오늘 작업은 완료됐어. 이번 주 pass ${used}/${max}`,
    statusWaiting: ({ dateKey, elapsedSeconds, used, max }) =>
      `[WAIT] ${dateKey} 아직 시작 전이야. ${elapsedSeconds}초 지났어. 이번 주 pass ${used}/${max}`,
    passLimitReached: ({ used, max }) =>
      `[PASS] 이번 주 pass는 전부 썼어. ${used}/${max}`,
    passBeforeStart: '[PASS] pass는 세션이 열린 뒤에만 쓸 수 있어.',
    passAlreadyWorking:
      '[PASS] 이미 시작했잖아. 지금은 멈추지 말고 흐름을 조금만 더 지켜줘.',
    passAlreadyUsed: ({ used, max }) =>
      `[PASS] 오늘은 이미 pass 처리됐어. 이번 주 pass ${used}/${max}`,
    passUsed: ({ message, used, max }) =>
      `[PASS] ${message} 이번 주 pass ${used}/${max}`,
    doneNoSession:
      '[DONE] 완료할 세션이 아직 없어. 먼저 /forcestart나 /startwork로 시작을 알려줘.',
    doneBeforeStart:
      '[DONE] 아직 시작 확인이 없어. 완료 전에 /startwork로 먼저 내게 알려줘.',
    doneAlready: '[DONE] 오늘 작업은 이미 완료로 기록됐어. 잘했어.',
  };
}

module.exports = {
  buildYandereMessages,
};
