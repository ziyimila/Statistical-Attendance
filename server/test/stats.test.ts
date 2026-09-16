import { describe, expect, it } from 'vitest';
import { computeStats } from '../src/domain/stats.js';
import type { AttendanceRecord } from '../src/domain/types.js';

const term = { startDate: '2026-09-07', endDate: '2027-01-22' };
const holidays = [
  '2026-09-25',
  '2026-10-01',
  '2026-10-02',
  '2026-10-03',
  '2026-10-04',
  '2026-10-05',
  '2026-10-06',
  '2026-10-07',
  '2027-01-01',
];
const today = '2026-09-16';

function record(date: string, status: 'present' | 'leave', reason: AttendanceRecord['reason'] = null): AttendanceRecord {
  return { date, status, reason, note: null, byName: '妈妈' };
}

/** 9 月 7 日开学，9 月 16 日是第二周的周三 */
function statsOf(records: AttendanceRecord[], overrides: Partial<Parameters<typeof computeStats>[0]> = {}) {
  return computeStats({ records, holidays, term, scope: 'month', month: '2026-09', today, ...overrides });
}

describe('统计口径', () => {
  it('空记录时，把开学以来没打卡的日子算成未记录，今天算待打卡', () => {
    const result = statsOf([]);

    expect(result.schoolDays).toBe(8); // 9/7-9/11 + 9/14 + 9/15 + 今天
    expect(result.present).toBe(0);
    expect(result.leave).toBe(0);
    expect(result.unrecorded).toBe(7);
    expect(result.unrecordedDates).toEqual([
      '2026-09-07',
      '2026-09-08',
      '2026-09-09',
      '2026-09-10',
      '2026-09-11',
      '2026-09-14',
      '2026-09-15',
    ]);
    expect(result.pendingToday).toBe(true);
    expect(result.schoolDaysRemaining).toBe(9); // 9/17、9/18、9/21-24、9/28-30
  });

  it('出勤加请假加未记录加待打卡，正好等于应上学天数', () => {
    const records = [
      ...[
        '2026-09-07',
        '2026-09-08',
        '2026-09-09',
        '2026-09-10',
        '2026-09-11',
        '2026-09-16',
      ].map((date) => record(date, 'present')),
      record('2026-09-14', 'leave', 'sick'),
      record('2026-09-15', 'leave', 'sick'),
    ];
    const result = statsOf(records);

    expect(result.present).toBe(6);
    expect(result.leave).toBe(2);
    expect(result.unrecorded).toBe(0);
    expect(result.pendingToday).toBe(false);
    expect(result.present + result.leave + result.unrecorded + (result.pendingToday ? 1 : 0)).toBe(result.schoolDays);
  });

  it('请假明细按时间倒序列出，带原因和备注', () => {
    const result = statsOf([
      { date: '2026-09-14', status: 'leave', reason: 'sick', note: '咳嗽', byName: '妈妈' },
      { date: '2026-09-08', status: 'leave', reason: 'personal', note: null, byName: '爸爸' },
    ]);

    expect(result.leaveDetails.map((detail) => detail.date)).toEqual(['2026-09-14', '2026-09-08']);
    expect(result.leaveDetails[0]).toMatchObject({ weekday: '周一', reasonLabel: '病假', note: '咳嗽' });
  });

  it('周末顺手标的请假不算进天数', () => {
    const result = statsOf([record('2026-09-19', 'leave', 'sick')]);

    expect(result.leave).toBe(0);
    expect(result.leaveDetails).toHaveLength(0);
  });

  it('节假日不算应上学日', () => {
    const result = statsOf([], { month: '2026-10', today: '2026-10-08' });

    // 10 月共 22 个工作日，10/1-10/7 放假（其中 5 天是工作日），剩 17 个应上学日
    expect(result.schoolDays + result.schoolDaysRemaining).toBe(17);
    expect(result.schoolDays).toBe(1); // 只过了 10/8 这一天
    expect(result.pendingToday).toBe(true);
  });

  it('提前请假只提示、不计入已请假天数', () => {
    const result = statsOf([record('2026-09-17', 'leave', 'sick'), record('2026-09-18', 'leave', 'sick')]);

    expect(result.leave).toBe(0);
    expect(result.upcomingLeaveDates).toEqual(['2026-09-17', '2026-09-18']);
  });

  it('学期统计跨月累加', () => {
    const result = statsOf([], { scope: 'term', today: '2026-09-16' });
    const month = statsOf([], { today: '2026-09-16' });

    expect(result.schoolDays).toBe(month.schoolDays);
    expect(result.schoolDaysRemaining).toBeGreaterThan(80);
  });

  it('月份落在学期之外时返回空统计', () => {
    const result = statsOf([], { month: '2027-03' });

    expect(result.range).toBeNull();
    expect(result.schoolDays).toBe(0);
    expect(result.leaveDetails).toHaveLength(0);
  });
});
