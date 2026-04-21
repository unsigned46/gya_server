const assert = require('node:assert/strict');
const test = require('node:test');

const { buildWeeklyReview, formatDuration } = require('../src/review');

test('formatDuration renders seconds and minutes', () => {
  assert.equal(formatDuration(12_000), '12초');
  assert.equal(formatDuration(120_000), '2분');
  assert.equal(formatDuration(125_000), '2분 5초');
});

test('buildWeeklyReview summarizes current week events', () => {
  const events = [
    {
      type: 'session_opened',
      occurredAtMs: Date.parse('2026-04-21T11:00:00.000Z'),
      dateKey: '2026-04-21',
      sessionDateKey: '2026-04-21',
      metadata: { trigger: 'schedule' },
    },
    {
      type: 'reminder_sent',
      occurredAtMs: Date.parse('2026-04-21T11:00:00.000Z'),
      dateKey: '2026-04-21',
      sessionDateKey: '2026-04-21',
      metadata: {},
    },
    {
      type: 'session_started',
      occurredAtMs: Date.parse('2026-04-21T11:02:00.000Z'),
      dateKey: '2026-04-21',
      sessionDateKey: '2026-04-21',
      metadata: { elapsedMs: 120_000 },
    },
    {
      type: 'session_done',
      occurredAtMs: Date.parse('2026-04-21T11:32:00.000Z'),
      dateKey: '2026-04-21',
      sessionDateKey: '2026-04-21',
      metadata: { workElapsedMs: 1_800_000 },
    },
  ];

  const message = buildWeeklyReview(events, {
    now: new Date('2026-04-21T12:00:00.000Z'),
    timeZone: 'Asia/Seoul',
  });

  assert.match(message, /세션 열린 날: 1일/);
  assert.match(message, /시작: 1회 \(100%\)/);
  assert.match(message, /완료: 1회/);
  assert.match(message, /평균 착수 시간: 2분/);
  assert.match(message, /평균 작업 지속: 30분/);
});
