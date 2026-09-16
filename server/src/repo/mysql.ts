import mysql, { type Pool, type RowDataPacket } from 'mysql2/promise';
import type { AttendanceRecord, Holiday, LeaveReason, Term } from '../domain/types.js';
import { SCHEMA_STATEMENTS } from '../db/schema.js';
import type { NewTerm, Repo, UpsertInput } from './types.js';

export interface MysqlOptions {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

interface RecordRow extends RowDataPacket {
  date: string;
  status: 'present' | 'leave';
  reason: LeaveReason | null;
  note: string | null;
  by_name: string | null;
  updated_at: string;
}

interface HolidayRow extends RowDataPacket {
  date: string;
  label: string;
}

interface TermRow extends RowDataPacket {
  id: number;
  name: string;
  start_date: string;
  end_date: string;
  is_active: number;
}

interface SettingRow extends RowDataPacket {
  v: string;
}

export class MysqlRepo implements Repo {
  private pool: Pool;

  constructor(options: MysqlOptions) {
    this.pool = mysql.createPool({
      ...options,
      waitForConnections: true,
      connectionLimit: 5,
      // DATE / TIMESTAMP 一律以字符串返回，避免驱动把它当成 Date 再做一次时区换算
      dateStrings: true,
      charset: 'utf8mb4_unicode_ci',
    });
  }

  async init(): Promise<void> {
    for (const statement of SCHEMA_STATEMENTS) {
      await this.pool.query(statement);
    }
  }

  async ping(): Promise<boolean> {
    try {
      await this.pool.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  async listRecords(from: string, to: string): Promise<AttendanceRecord[]> {
    const [rows] = await this.pool.query<RecordRow[]>(
      `SELECT date, status, reason, note, by_name, updated_at
         FROM records
        WHERE date BETWEEN ? AND ?
        ORDER BY date`,
      [from, to],
    );
    return rows.map(toRecord);
  }

  async upsertRecord(input: UpsertInput, byName: string): Promise<AttendanceRecord> {
    // 用 REPLACE 而不是 ON DUPLICATE KEY UPDATE：语义清楚，且不依赖 MySQL 8.0.19+ 的别名语法
    const reason = input.status === 'leave' ? (input.reason ?? null) : null;
    await this.pool.query(
      'REPLACE INTO records (date, status, reason, note, by_name, updated_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
      [input.date, input.status, reason, input.note ?? null, byName],
    );
    const [rows] = await this.pool.query<RecordRow[]>(
      'SELECT date, status, reason, note, by_name, updated_at FROM records WHERE date = ?',
      [input.date],
    );
    return toRecord(rows[0]);
  }

  async deleteRecord(date: string): Promise<boolean> {
    const [result] = await this.pool.query<mysql.ResultSetHeader>('DELETE FROM records WHERE date = ?', [date]);
    return result.affectedRows > 0;
  }

  async listHolidays(): Promise<Holiday[]> {
    const [rows] = await this.pool.query<HolidayRow[]>('SELECT date, label FROM holidays ORDER BY date');
    return rows.map((row) => ({ date: row.date, label: row.label }));
  }

  async addHoliday(date: string, label: string): Promise<Holiday> {
    await this.pool.query('REPLACE INTO holidays (date, label) VALUES (?, ?)', [date, label]);
    return { date, label };
  }

  async deleteHoliday(date: string): Promise<boolean> {
    const [result] = await this.pool.query<mysql.ResultSetHeader>('DELETE FROM holidays WHERE date = ?', [date]);
    return result.affectedRows > 0;
  }

  async listTerms(): Promise<Term[]> {
    const [rows] = await this.pool.query<TermRow[]>(
      'SELECT id, name, start_date, end_date, is_active FROM terms ORDER BY start_date',
    );
    return rows.map(toTerm);
  }

  async getActiveTerm(): Promise<Term | null> {
    const [rows] = await this.pool.query<TermRow[]>(
      'SELECT id, name, start_date, end_date, is_active FROM terms ORDER BY is_active DESC, start_date DESC LIMIT 1',
    );
    return rows[0] ? toTerm(rows[0]) : null;
  }

  async createTerm(term: NewTerm): Promise<Term> {
    if (term.isActive) {
      await this.pool.query('UPDATE terms SET is_active = 0');
    }
    const [result] = await this.pool.query<mysql.ResultSetHeader>(
      'INSERT INTO terms (name, start_date, end_date, is_active) VALUES (?, ?, ?, ?)',
      [term.name, term.startDate, term.endDate, term.isActive ? 1 : 0],
    );
    return { ...term, id: result.insertId };
  }

  async updateTerm(id: number, patch: Partial<NewTerm>): Promise<Term | null> {
    const [rows] = await this.pool.query<TermRow[]>(
      'SELECT id, name, start_date, end_date, is_active FROM terms WHERE id = ?',
      [id],
    );
    if (!rows[0]) return null;
    const merged: Term = { ...toTerm(rows[0]), ...patch };
    if (patch.isActive) {
      await this.pool.query('UPDATE terms SET is_active = 0');
    }
    await this.pool.query('UPDATE terms SET name = ?, start_date = ?, end_date = ?, is_active = ? WHERE id = ?', [
      merged.name,
      merged.startDate,
      merged.endDate,
      merged.isActive ? 1 : 0,
      id,
    ]);
    return merged;
  }

  async getSetting(key: string): Promise<string | null> {
    const [rows] = await this.pool.query<SettingRow[]>('SELECT v FROM app_settings WHERE k = ?', [key]);
    return rows[0]?.v ?? null;
  }

  async setSetting(key: string, value: string): Promise<void> {
    await this.pool.query('REPLACE INTO app_settings (k, v) VALUES (?, ?)', [key, value]);
  }
}

function toRecord(row: RecordRow | undefined): AttendanceRecord {
  if (!row) throw new Error('记录不存在');
  return {
    date: row.date,
    status: row.status,
    reason: row.reason ?? null,
    note: row.note ?? null,
    byName: row.by_name ?? null,
    updatedAt: row.updated_at,
  };
}

function toTerm(row: TermRow): Term {
  return {
    id: row.id,
    name: row.name,
    startDate: row.start_date,
    endDate: row.end_date,
    isActive: Boolean(row.is_active),
  };
}
