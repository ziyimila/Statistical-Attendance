export type AttendanceStatus = 'present' | 'leave';

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
  status: AttendanceStatus;
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
