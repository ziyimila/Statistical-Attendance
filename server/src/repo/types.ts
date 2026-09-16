import type { AttendanceRecord, AttendanceStatus, Holiday, LeaveReason, Term } from '../domain/types.js';

export interface UpsertInput {
  date: string;
  status: AttendanceStatus;
  reason?: LeaveReason | null;
  note?: string | null;
}

export type NewTerm = Omit<Term, 'id'>;

/** 数据访问接口。生产用 MySQL，测试和本地体验用内存实现。 */
export interface Repo {
  init(): Promise<void>;
  ping(): Promise<boolean>;
  close(): Promise<void>;

  listRecords(from: string, to: string): Promise<AttendanceRecord[]>;
  upsertRecord(input: UpsertInput, byName: string): Promise<AttendanceRecord>;
  deleteRecord(date: string): Promise<boolean>;

  listHolidays(): Promise<Holiday[]>;
  addHoliday(date: string, label: string): Promise<Holiday>;
  deleteHoliday(date: string): Promise<boolean>;

  listTerms(): Promise<Term[]>;
  getActiveTerm(): Promise<Term | null>;
  createTerm(term: NewTerm): Promise<Term>;
  updateTerm(id: number, patch: Partial<NewTerm>): Promise<Term | null>;

  getSetting(key: string): Promise<string | null>;
  setSetting(key: string, value: string): Promise<void>;
}
