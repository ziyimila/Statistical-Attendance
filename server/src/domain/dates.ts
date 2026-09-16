/** 日期的唯一真理：全程用本地日历日期的 YYYY-MM-DD 字符串，不做时区换算。 */

export function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseDateString(value: string): Date {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function isValidDateString(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return toDateString(parseDateString(value)) === value;
}

export function isValidMonthString(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export function addDays(value: string, days: number): string {
  const date = parseDateString(value);
  date.setDate(date.getDate() + days);
  return toDateString(date);
}

/** YYYY-MM-DD 是定长字符串，字典序即时间序 */
export function compareDates(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function isWeekend(value: string): boolean {
  const day = parseDateString(value).getDay();
  return day === 0 || day === 6;
}

const WEEKDAY_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

export function weekdayLabel(value: string): string {
  return WEEKDAY_LABELS[parseDateString(value).getDay()];
}

export function eachDate(from: string, to: string): string[] {
  const result: string[] = [];
  for (let cursor = from; compareDates(cursor, to) <= 0; cursor = addDays(cursor, 1)) {
    result.push(cursor);
  }
  return result;
}

export function monthRange(month: string): { from: string; to: string } {
  const [y, m] = month.split('-').map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  return { from: `${month}-01`, to: `${month}-${String(lastDay).padStart(2, '0')}` };
}

export function monthsBetween(from: string, to: string): string[] {
  const months: string[] = [];
  let [y, m] = from.split('-').map(Number);
  const [endY, endM] = to.split('-').map(Number);
  while (y < endY || (y === endY && m <= endM)) {
    months.push(`${y}-${String(m).padStart(2, '0')}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return months;
}

export function intersectRange(
  a: { from: string; to: string },
  b: { from: string; to: string },
): { from: string; to: string } | null {
  const from = compareDates(a.from, b.from) > 0 ? a.from : b.from;
  const to = compareDates(a.to, b.to) < 0 ? a.to : b.to;
  return compareDates(from, to) <= 0 ? { from, to } : null;
}
