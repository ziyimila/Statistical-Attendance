import { describe, expect, it } from 'vitest';
import { computeStats } from '../src/domain/stats.js';
import type { AttendancePortion, AttendanceRecord, LeaveReason } from '../src/domain/types.js';

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

function record(date: string, portion: AttendancePortion, reason: LeaveReason | null = null): AttendanceRecord {
  return { date, portion, reason, note: null, byName: '妈妈' };
}

/** 9 月 7 日开学，9 月 16 日是第二周的周三 */
function statsOf(records: AttendanceRecord[], overrides: Partial<Parameters<typeof computeStats>[0]> = {}) {
  return computeStats({ records, holidays, term, scope: 'month', month: '2026-09', today, ...overrides });
}

describe('统计口径', () => {
  it('空记录时，把开学以来没打卡的日子算成未记录，今天算待打卡', () => {
    const result = statsOf([]);

    expect(result.schoolDays).toBe(8); // 9/7-9/11 + 9/14 + 9/15 + 今天
    expect(result.presentDays).toBe(0);
    expect(result.leaveDays).toBe(0);
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
    expect(result.holidayDays).toBe(0); // 中秋在 9/25，还没到
  });

  it('只去了半天，算半天出勤半天缺勤', () => {
    const result = statsOf([
      record('2026-09-07', 'full'),
      record('2026-09-08', 'full'),
      record('2026-09-09', 'full'),
      record('2026-09-10', 'full'),
      record('2026-09-11', 'full'),
      record('2026-09-14', 'absent', 'sick'), // 全天没去
      record('2026-09-15', 'morning', 'sick'), // 上午去了，中午接走
      record('2026-09-16', 'full'),
    ]);

    expect(result.presentDays).toBe(6.5);
    expect(result.leaveDays).toBe(1.5);
    expect(result.halfDayLeaveCount).toBe(1);
    expect(result.unrecorded).toBe(0);
    expect(result.pendingToday).toBe(false);
    // 出勤率按"已记录的日子"算，不让忘记打卡的日子拉低它
    expect(result.recordedDays).toBe(8);
    expect(result.attendanceRate).toBeCloseTo(6.5 / 8, 5);
  });

  it('出勤加缺勤加未记录加待打卡，正好等于应上学天数', () => {
    const result = statsOf([
      record('2026-09-07', 'full'),
      record('2026-09-14', 'absent', 'sick'),
      record('2026-09-15', 'afternoon', 'sick'), // 上午请假，下午才去
    ]);

    const accounted = result.presentDays + result.leaveDays + result.unrecorded + (result.pendingToday ? 1 : 0);
    expect(accounted).toBe(result.schoolDays);
  });

  it('请假明细按时间倒序，半天也标出来', () => {
    const result = statsOf([
      { date: '2026-09-14', portion: 'absent', reason: 'sick', note: '咳嗽', byName: '妈妈' },
      { date: '2026-09-15', portion: 'morning', reason: 'sick', note: '中午接走', byName: '爸爸' },
      { date: '2026-09-08', portion: 'absent', reason: 'personal', note: null, byName: '爸爸' },
    ]);

    expect(result.leaveDetails.map((detail) => detail.date)).toEqual([
      '2026-09-15',
      '2026-09-14',
      '2026-09-08',
    ]);
    expect(result.leaveDetails[0]).toMatchObject({
      portionLabel: '只去了上午',
      absentDays: 0.5,
      reasonLabel: '病假',
      note: '中午接走',
    });
  });

  it('缺勤按原因分类小计', () => {
    const result = statsOf([
      record('2026-09-14', 'absent', 'sick'),
      record('2026-09-15', 'morning', 'sick'),
      record('2026-09-08', 'absent', 'personal'),
    ]);

    expect(result.leaveByReason).toEqual([
      { key: 'sick', label: '病假', days: 1.5 },
      { key: 'personal', label: '事假', days: 1 },
    ]);
  });

  it('周末顺手标的不算进天数', () => {
    const result = statsOf([record('2026-09-19', 'absent', 'sick')]);

    expect(result.leaveDays).toBe(0);
    expect(result.leaveDetails).toHaveLength(0);
  });

  it('园里放假不算应上学日，也不算缺勤', () => {
    const result = statsOf([], { month: '2026-10', today: '2026-10-08' });

    // 10 月共 22 个工作日，国庆 10/1-10/7 里有 5 个工作日放假
    expect(result.holidayDays).toBe(5);
    expect(result.schoolDays + result.schoolDaysRemaining).toBe(17);
    expect(result.schoolDays).toBe(1); // 只过了 10/8 这一天
    expect(result.leaveDays).toBe(0);
  });

  it('提前请假只提示、不计入已缺勤天数', () => {
    const result = statsOf([record('2026-09-17', 'absent', 'sick'), record('2026-09-18', 'absent', 'sick')]);

    expect(result.leaveDays).toBe(0);
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
