const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const MONTHS = ['1 月', '2 月', '3 月', '4 月', '5 月', '6 月', '7 月', '8 月', '9 月', '10 月', '11 月', '12 月'];

export function parseDate(value: string): Date {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function toDateString(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${m}-${d}`;
}

export function addDays(value: string, days: number): string {
  const date = parseDate(value);
  date.setDate(date.getDate() + days);
  return toDateString(date);
}

export function isWeekend(value: string): boolean {
  const day = parseDate(value).getDay();
  return day === 0 || day === 6;
}

export function weekdayLabel(value: string): string {
  return WEEKDAYS[parseDate(value).getDay()];
}

export function monthLabel(month: string): string {
  const [year, m] = month.split('-').map(Number);
  return `${year} 年 ${MONTHS[m - 1]}`;
}

export function shortDate(value: string): string {
  const [, m, d] = value.split('-').map(Number);
  return `${m}/${d}`;
}

export function fullDate(value: string): string {
  const [y, m, d] = value.split('-').map(Number);
  return `${y} 年 ${m} 月 ${d} 日 ${weekdayLabel(value)}`;
}

export function monthRange(month: string): { from: string; to: string } {
  const [y, m] = month.split('-').map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  return { from: `${month}-01`, to: `${month}-${String(lastDay).padStart(2, '0')}` };
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const date = new Date(y, m - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/** 从某天起往后数 count 个上学日（跳过周末和节假日），用于"请几天" */
export function nextSchoolDays(start: string, count: number, holidays: Set<string>): string[] {
  const result: string[] = [];
  let cursor = start;
  let guard = 0;
  while (result.length < count && guard < 60) {
    if (!isWeekend(cursor) && !holidays.has(cursor)) result.push(cursor);
    cursor = addDays(cursor, 1);
    guard += 1;
  }
  return result;
}

export function monthGrid(month: string): string[] {
  const { from, to } = monthRange(month);
  const first = parseDate(from);
  // 周一为一周的第一天
  const leading = (first.getDay() + 6) % 7;
  const cells: string[] = [];
  for (let i = 0; i < leading; i += 1) cells.push('');
  for (let cursor = from; cursor <= to; cursor = addDays(cursor, 1)) cells.push(cursor);
  while (cells.length % 7 !== 0) cells.push('');
  return cells;
}
