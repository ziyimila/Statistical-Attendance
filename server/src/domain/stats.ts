import { compareDates, eachDate, intersectRange, isWeekend, monthRange, weekdayLabel } from './dates.js';
import {
  LEAVE_REASON_LABELS,
  type AttendanceRecord,
  type LeaveReason,
} from './types.js';

export interface StatsInput {
  records: AttendanceRecord[];
  /** 放假的日期集合，形如 2026-10-01 */
  holidays: Iterable<string>;
  term: { startDate: string; endDate: string };
  scope: 'month' | 'term';
  /** scope = month 时必填，形如 2026-09 */
  month?: string;
  today: string;
}

export interface LeaveDetail {
  date: string;
  weekday: string;
  reason: LeaveReason | null;
  reasonLabel: string;
  note: string | null;
}

export interface StatsResult {
  range: { from: string; to: string } | null;
  /** 截至今天（含）的应上学天数，也就是统计出勤率的分母 */
  schoolDays: number;
  present: number;
  leave: number;
  unrecorded: number;
  unrecordedDates: string[];
  /** 今天是要上学的日子，但还没有打卡 */
  pendingToday: boolean;
  /** 今天之后还剩多少个应上学日 */
  schoolDaysRemaining: number;
  /** 今天之后已经提前请假的日期 */
  upcomingLeaveDates: string[];
  leaveDetails: LeaveDetail[];
}

const EMPTY: StatsResult = {
  range: null,
  schoolDays: 0,
  present: 0,
  leave: 0,
  unrecorded: 0,
  unrecordedDates: [],
  pendingToday: false,
  schoolDaysRemaining: 0,
  upcomingLeaveDates: [],
  leaveDetails: [],
};

/**
 * 统计口径的唯一定义处。
 * 纯函数：不读数据库、不看系统时间，输入什么算什么，方便测试。
 */
export function computeStats(input: StatsInput): StatsResult {
  const holidaySet = input.holidays instanceof Set ? input.holidays : new Set(input.holidays);

  const termRange = { from: input.term.startDate, to: input.term.endDate };
  let range: { from: string; to: string } | null;
  if (input.scope === 'month') {
    if (!input.month) throw new Error('scope=month 时必须提供 month');
    range = intersectRange(monthRange(input.month), termRange);
  } else {
    range = termRange;
  }
  if (!range) return { ...EMPTY };

  const byDate = new Map(input.records.map((record) => [record.date, record]));

  let schoolDays = 0;
  let present = 0;
  let leave = 0;
  const unrecordedDates: string[] = [];
  let pendingToday = false;
  let schoolDaysRemaining = 0;
  const upcomingLeaveDates: string[] = [];

  for (const date of eachDate(range.from, range.to)) {
    if (isWeekend(date) || holidaySet.has(date)) continue;

    // 未来的日子还没发生：只关心"提前请了假"，不参与出勤统计
    if (compareDates(date, input.today) > 0) {
      schoolDaysRemaining += 1;
      if (byDate.get(date)?.status === 'leave') upcomingLeaveDates.push(date);
      continue;
    }

    schoolDays += 1;

    const record = byDate.get(date);
    if (record?.status === 'present') {
      present += 1;
    } else if (record?.status === 'leave') {
      leave += 1;
    } else if (compareDates(date, input.today) < 0) {
      unrecordedDates.push(date);
    } else {
      pendingToday = true;
    }
  }

  // 请假明细只列已经发生的请假；周末顺手标的请假不算天数
  const countedDays = new Set(
    eachDate(range.from, range.to).filter(
      (date) => !isWeekend(date) && !holidaySet.has(date) && compareDates(date, input.today) <= 0,
    ),
  );
  const leaveDetails: LeaveDetail[] = input.records
    .filter((record) => record.status === 'leave' && countedDays.has(record.date))
    .sort((a, b) => compareDates(b.date, a.date))
    .map((record) => ({
      date: record.date,
      weekday: weekdayLabel(record.date),
      reason: record.reason,
      reasonLabel: record.reason ? LEAVE_REASON_LABELS[record.reason] : '请假',
      note: record.note,
    }));

  return {
    range,
    schoolDays,
    present,
    leave,
    unrecorded: unrecordedDates.length,
    unrecordedDates,
    pendingToday,
    schoolDaysRemaining,
    upcomingLeaveDates: upcomingLeaveDates.sort(),
    leaveDetails,
  };
}
