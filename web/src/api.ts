import type { AppConfig, AttendanceRecord, Holiday, LeaveReason, StatsResult, Term } from './types';

export class UnauthorizedError extends Error {}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (response.status === 401) throw new UnauthorizedError('请先登录');
  const text = await response.text();
  const body = text ? JSON.parse(text) : {};
  if (!response.ok) throw new Error(body?.error?.message ?? '请求失败');
  return body as T;
}

export interface RecordPayload {
  status: 'present' | 'leave';
  reason?: LeaveReason | null;
  note?: string | null;
}

export const api = {
  getConfig: () => request<AppConfig>('/api/config'),
  login: (code: string) => request<{ who: string }>('/api/login', { method: 'POST', body: JSON.stringify({ code }) }),
  logout: () => request<{ ok: boolean }>('/api/logout', { method: 'POST' }),

  listRecords: (from: string, to: string) =>
    request<{ records: AttendanceRecord[] }>(`/api/records?from=${from}&to=${to}`).then((r) => r.records),
  upsertRecord: (date: string, payload: RecordPayload) =>
    request<{ record: AttendanceRecord }>(`/api/records/${date}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }).then((r) => r.record),
  bulkRecords: (dates: string[], payload: RecordPayload) =>
    request<{ records: AttendanceRecord[] }>('/api/records/bulk', {
      method: 'POST',
      body: JSON.stringify({ dates, ...payload }),
    }).then((r) => r.records),
  deleteRecord: (date: string) => request<{ deleted: boolean }>(`/api/records/${date}`, { method: 'DELETE' }),

  stats: (scope: 'month' | 'term', month?: string) =>
    request<{ stats: StatsResult }>(`/api/stats?scope=${scope}${month ? `&month=${month}` : ''}`).then((r) => r.stats),

  updateTerm: (id: number, patch: Partial<Omit<Term, 'id'>>) =>
    request<{ term: Term }>(`/api/terms/${id}`, { method: 'PUT', body: JSON.stringify(patch) }).then((r) => r.term),
  addHoliday: (date: string, label: string) =>
    request<{ holiday: Holiday }>('/api/holidays', { method: 'POST', body: JSON.stringify({ date, label }) }).then(
      (r) => r.holiday,
    ),
  deleteHoliday: (date: string) =>
    request<{ deleted: boolean }>(`/api/holidays/${date}`, { method: 'DELETE' }),
  changePasscode: (code: string, who?: string) =>
    request<{ ok: boolean }>('/api/passcode', { method: 'PUT', body: JSON.stringify({ code, who }) }),
};
