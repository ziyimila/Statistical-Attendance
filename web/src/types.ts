export type AttendanceStatus = 'present' | 'leave';
export type LeaveReason = 'sick' | 'personal' | 'closed' | 'other';

export interface AttendanceRecord {
  date: string;
  status: AttendanceStatus;
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
  reason: LeaveReason | null;
  reasonLabel: string;
  note: string | null;
}

export interface StatsResult {
  range: { from: string; to: string } | null;
  schoolDays: number;
  present: number;
  leave: number;
  unrecorded: number;
  unrecordedDates: string[];
  pendingToday: boolean;
  schoolDaysRemaining: number;
  upcomingLeaveDates: string[];
  leaveDetails: LeaveDetail[];
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
