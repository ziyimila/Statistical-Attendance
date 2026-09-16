import { addDays } from '../domain/dates.js';
import type { Holiday } from '../domain/types.js';
import type { Repo } from './types.js';

/**
 * 首次启动时的预填数据。
 * 学期起止和节假日都可以在设置页修改——幼儿园的放假安排常和国定假期不完全一致，
 * 这里的值只是让第一天打开时不至于空空如也。
 */
export const DEFAULT_TERM = {
  name: '2026 秋季学期',
  startDate: '2026-09-07',
  endDate: '2027-01-22',
  isActive: true,
};

export function defaultHolidays(): Holiday[] {
  const holidays: Holiday[] = [
    { date: '2026-09-25', label: '中秋节' },
    { date: '2027-01-01', label: '元旦' },
  ];
  for (let i = 0; i < 7; i += 1) {
    const date = addDays('2026-10-01', i);
    holidays.push({ date, label: '国庆节' });
  }
  return holidays;
}

export async function seedDefaults(repo: Repo): Promise<void> {
  const terms = await repo.listTerms();
  if (terms.length === 0) {
    await repo.createTerm(DEFAULT_TERM);
  }

  const holidays = await repo.listHolidays();
  if (holidays.length === 0) {
    for (const holiday of defaultHolidays()) {
      await repo.addHoliday(holiday.date, holiday.label);
    }
  }
}
