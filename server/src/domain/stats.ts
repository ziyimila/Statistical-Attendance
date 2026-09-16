import { compareDates, eachDate, intersectRange, isWeekend, monthRange, weekdayLabel } from './dates.js';
import {
  ABSENT_HALVES,
  LEAVE_REASON_LABELS,
  PORTION_LABELS,
  PRESENT_HALVES,
  type AttendancePortion,
  type AttendanceRecord,
  type LeaveReason,
} from './types.js';

export interface StatsInput {
  records: AttendanceRecord[];
  /** 放假的日期：法定假期、园里停课、园庆活动都算，落在这儿的日子不参与出勤统计 */
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
  portion: AttendancePortion;
  portionLabel: string;
  /** 这天缺了几天：全天 1，只去半天 0.5 */
  absentDays: number;
  reason: LeaveReason | null;
  reasonLabel: string;
  note: string | null;
}

export interface ReasonTotal {
  key: string;
  label: string;
  days: number;
}

export interface StatsResult {
  range: { from: string; to: string } | null;
  /** 截至今天（含）的应上学天数，出勤率的分母 */
  schoolDays: number;
  /** 出勤天数，可能出现 3.5 这样的半天 */
  presentDays: number;
  /** 缺勤天数，可能是 0.5 的奇数倍 */
  leaveDays: number;
  /** 其中"只去了半天"的次数 */
  halfDayLeaveCount: number;
  /** 已经记过的天数（出勤 + 缺勤），出勤率的分母 */
  recordedDays: number;
  /** 出勤率 = 出勤 / 已记录天数，0~1；一天都没记时为 0 */
  attendanceRate: number;
  unrecorded: number;
  unrecordedDates: string[];
  /** 今天是要上学的日子，但还没有打卡 */
  pendingToday: boolean;
  /** 今天之后还剩多少个应上学日 */
  schoolDaysRemaining: number;
  /** 区间内因为园里放假而不上学的天数（不含周末，不含未来） */
  holidayDays: number;
  /** 今天之后已经提前请假的日期 */
  upcomingLeaveDates: string[];
  leaveDetails: LeaveDetail[];
  /** 缺勤按原因分类的小计，天数为半天折算后的值 */
  leaveByReason: ReasonTotal[];
}

const EMPTY: StatsResult = {
  range: null,
  schoolDays: 0,
  presentDays: 0,
  leaveDays: 0,
  halfDayLeaveCount: 0,
  recordedDays: 0,
  attendanceRate: 0,
  unrecorded: 0,
  unrecordedDates: [],
  pendingToday: false,
  schoolDaysRemaining: 0,
  holidayDays: 0,
  upcomingLeaveDates: [],
  leaveDetails: [],
  leaveByReason: [],
};

/**
 * 统计口径的唯一定义处。
 * 纯函数：不读数据库、不看系统时间，输入什么算什么，方便测试。
 *
 * 内部按"半个天"为单位累加，最后再除以 2，免得 0.5 加出一堆浮点误差。
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
  let presentHalves = 0;
  let leaveHalves = 0;
  let halfDayLeaveCount = 0;
  let holidayDays = 0;
  let schoolDaysRemaining = 0;
  let pendingToday = false;
  const unrecordedDates: string[] = [];
  const upcomingLeaveDates: string[] = [];
  const leaveDetails: LeaveDetail[] = [];
  const reasonHalves = new Map<string, number>();

  for (const date of eachDate(range.from, range.to)) {
    if (isWeekend(date)) continue;

    // 园里放假：不进应上学日，也不算缺勤
    if (holidaySet.has(date)) {
      if (compareDates(date, input.today) <= 0) holidayDays += 1;
      continue;
    }

    // 未来的日子还没发生：只关心"提前请了假"
    if (compareDates(date, input.today) > 0) {
      schoolDaysRemaining += 1;
      if (byDate.get(date)?.portion === 'absent') upcomingLeaveDates.push(date);
      continue;
    }

    schoolDays += 1;
    const record = byDate.get(date);

    // 今天的空档算"待打卡"，不算未记录：今天还没过完
    if (!record) {
      if (compareDates(date, input.today) < 0) unrecordedDates.push(date);
      continue;
    }

    presentHalves += PRESENT_HALVES[record.portion];

    const absentHalves = ABSENT_HALVES[record.portion];
    if (absentHalves === 0) continue;

    leaveHalves += absentHalves;
    if (record.portion !== 'absent') halfDayLeaveCount += 1;

    const key = record.reason ?? 'unspecified';
    reasonHalves.set(key, (reasonHalves.get(key) ?? 0) + absentHalves);

    leaveDetails.push({
      date,
      weekday: weekdayLabel(date),
      portion: record.portion,
      portionLabel: PORTION_LABELS[record.portion],
      absentDays: absentHalves / 2,
      reason: record.reason,
      reasonLabel: record.reason ? LEAVE_REASON_LABELS[record.reason] : '未填原因',
      note: record.note,
    });
  }

  // 今天没打卡就是"待打卡"（今天不在学期内或今天放假则不算）
  if (
    !byDate.has(input.today) &&
    compareDates(input.today, range.from) >= 0 &&
    compareDates(input.today, range.to) <= 0 &&
    !isWeekend(input.today) &&
    !holidaySet.has(input.today)
  ) {
    pendingToday = true;
  }

  const leaveByReason: ReasonTotal[] = [...reasonHalves.entries()]
    .map(([key, halves]) => ({
      key,
      label: key === 'unspecified' ? '未填原因' : LEAVE_REASON_LABELS[key as LeaveReason],
      days: halves / 2,
    }))
    .sort((a, b) => b.days - a.days);

  return {
    range,
    schoolDays,
    presentDays: presentHalves / 2,
    leaveDays: leaveHalves / 2,
    halfDayLeaveCount,
    recordedDays: (presentHalves + leaveHalves) / 2,
    attendanceRate: presentHalves + leaveHalves === 0 ? 0 : presentHalves / (presentHalves + leaveHalves),
    unrecorded: unrecordedDates.length,
    unrecordedDates,
    pendingToday,
    schoolDaysRemaining,
    holidayDays,
    upcomingLeaveDates: upcomingLeaveDates.sort(),
    leaveDetails: leaveDetails.sort((a, b) => compareDates(b.date, a.date)),
    leaveByReason,
  };
}
