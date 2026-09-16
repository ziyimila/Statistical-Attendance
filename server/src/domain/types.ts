/**
 * 一天的在园情况。
 * 幼儿园常规是 8:30–15:30 全天，半天是家长临时安排的例外，
 * 所以用"在园的部分"来描述，而不是简单的去了/没去：
 * full 全天在园 / morning 只去了上午 / afternoon 只去了下午 / absent 全天没去。
 */
export type AttendancePortion = 'full' | 'morning' | 'afternoon' | 'absent';

export const ATTENDANCE_PORTIONS: AttendancePortion[] = ['full', 'morning', 'afternoon', 'absent'];

export const PORTION_LABELS: Record<AttendancePortion, string> = {
  full: '全天在园',
  morning: '只去了上午',
  afternoon: '只去了下午',
  absent: '全天没去',
};

/** 折算成"出勤多少个半天"，单位是半天，统计时再除以 2 */
export const PRESENT_HALVES: Record<AttendancePortion, number> = {
  full: 2,
  morning: 1,
  afternoon: 1,
  absent: 0,
};

export const ABSENT_HALVES: Record<AttendancePortion, number> = {
  full: 0,
  morning: 1,
  afternoon: 1,
  absent: 2,
};

export type LeaveReason = 'sick' | 'personal' | 'closed' | 'other';

export const LEAVE_REASONS: LeaveReason[] = ['sick', 'personal', 'closed', 'other'];

export const LEAVE_REASON_LABELS: Record<LeaveReason, string> = {
  sick: '病假',
  personal: '事假',
  closed: '园里停课',
  other: '其他',
};

export interface AttendanceRecord {
  date: string;
  portion: AttendancePortion;
  reason: LeaveReason | null;
  note: string | null;
  byName: string | null;
  updatedAt?: string;
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
