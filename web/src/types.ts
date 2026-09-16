/** 一天的在园情况：常规是全天，半天是临时安排的例外 */
export type AttendancePortion = 'full' | 'morning' | 'afternoon' | 'absent';

export const PORTION_LABELS: Record<AttendancePortion, string> = {
  full: '全天在园',
  morning: '只去了上午',
  afternoon: '只去了下午',
  absent: '全天没去',
};

export const PORTION_ORDER: AttendancePortion[] = ['full', 'morning', 'afternoon', 'absent'];

export type LeaveReason = 'sick' | 'personal' | 'closed' | 'other';

export interface AttendanceRecord {
  date: string;
  portion: AttendancePortion;
  reason: LeaveReason | null;
  note: string | null;
  byName: string | null;
}

export interface Holiday {
  date: string;
  label: string;
}

export interface Term {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

export interface LeaveDetail {
  date: string;
  weekday: string;
  portion: AttendancePortion;
  portionLabel: string;
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
  schoolDays: number;
  presentDays: number;
  leaveDays: number;
  halfDayLeaveCount: number;
  recordedDays: number;
  attendanceRate: number;
  unrecorded: number;
  unrecordedDates: string[];
  pendingToday: boolean;
  schoolDaysRemaining: number;
  holidayDays: number;
  upcomingLeaveDates: string[];
  leaveDetails: LeaveDetail[];
  leaveByReason: ReasonTotal[];
}

export interface AppConfig {
  today: string;
  tomorrow: string;
  who: string | null;
  activeTerm: Term | null;
  terms: Term[];
  holidays: Holiday[];
}

export const LEAVE_REASON_LABELS: Record<LeaveReason, string> = {
  sick: '病假',
  personal: '事假',
  closed: '园里停课',
  other: '其他',
};

export const LEAVE_REASONS = Object.keys(LEAVE_REASON_LABELS) as LeaveReason[];

/** 0.5 天的显示：整数不带小数点，半天显示成 3.5 */
export function formatDays(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function formatRate(value: number): string {
  return `${Math.round(value * 100)}%`;
}
