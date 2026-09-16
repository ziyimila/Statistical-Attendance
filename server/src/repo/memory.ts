import type { AttendanceRecord, Holiday, Term } from '../domain/types.js';
import type { NewTerm, Repo, UpsertInput } from './types.js';

/**
 * 内存实现：跑测试用，也用于 `DB_DRIVER=memory` 的本地预览。
 * 进程重启数据就没了，不要在生产环境使用。
 */
export class MemoryRepo implements Repo {
  private records = new Map<string, AttendanceRecord>();
  private holidays = new Map<string, Holiday>();
  private terms: Term[] = [];
  private settings = new Map<string, string>();
  private nextTermId = 1;

  async init(): Promise<void> {}
  async ping(): Promise<boolean> {
    return true;
  }
  async close(): Promise<void> {}

  async listRecords(from: string, to: string): Promise<AttendanceRecord[]> {
    return [...this.records.values()]
      .filter((record) => record.date >= from && record.date <= to)
      .sort((a, b) => (a.date < b.date ? -1 : 1))
      .map((record) => ({ ...record }));
  }

  async upsertRecord(input: UpsertInput, byName: string): Promise<AttendanceRecord> {
    const record: AttendanceRecord = {
      date: input.date,
      status: input.status,
      reason: input.status === 'leave' ? (input.reason ?? null) : null,
      note: input.note ?? null,
      byName,
      updatedAt: new Date().toISOString(),
    };
    this.records.set(record.date, record);
    return { ...record };
  }

  async deleteRecord(date: string): Promise<boolean> {
    return this.records.delete(date);
  }

  async listHolidays(): Promise<Holiday[]> {
    return [...this.holidays.values()].sort((a, b) => (a.date < b.date ? -1 : 1)).map((h) => ({ ...h }));
  }

  async addHoliday(date: string, label: string): Promise<Holiday> {
    const holiday = { date, label };
    this.holidays.set(date, holiday);
    return { ...holiday };
  }

  async deleteHoliday(date: string): Promise<boolean> {
    return this.holidays.delete(date);
  }

  async listTerms(): Promise<Term[]> {
    return this.terms.map((term) => ({ ...term })).sort((a, b) => (a.startDate < b.startDate ? -1 : 1));
  }

  async getActiveTerm(): Promise<Term | null> {
    const term = this.terms.find((item) => item.isActive) ?? this.terms[this.terms.length - 1] ?? null;
    return term ? { ...term } : null;
  }

  async createTerm(term: NewTerm): Promise<Term> {
    const created: Term = { ...term, id: this.nextTermId++ };
    if (created.isActive) this.terms = this.terms.map((item) => ({ ...item, isActive: false }));
    this.terms.push(created);
    return { ...created };
  }

  async updateTerm(id: number, patch: Partial<NewTerm>): Promise<Term | null> {
    const index = this.terms.findIndex((item) => item.id === id);
    if (index === -1) return null;
    if (patch.isActive) this.terms = this.terms.map((item) => ({ ...item, isActive: false }));
    const updated: Term = { ...this.terms[index], ...patch };
    this.terms[index] = updated;
    return { ...updated };
  }

  async getSetting(key: string): Promise<string | null> {
    return this.settings.get(key) ?? null;
  }

  async setSetting(key: string, value: string): Promise<void> {
    this.settings.set(key, value);
  }
}
