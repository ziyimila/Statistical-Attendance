import { monthGrid, monthLabel, shiftMonth, shortDate, weekdayLabel } from '../dates';
import type { AppConfig, AttendanceRecord, StatsResult } from '../types';

interface Props {
  config: AppConfig;
  records: Map<string, AttendanceRecord>;
  month: string;
  monthStats: StatsResult | null;
  onChangeMonth: (month: string) => void;
  onPickDate: (date: string) => void;
}

const WEEK_HEADS = ['一', '二', '三', '四', '五', '六', '日'];

export default function CalendarView({ config, records, month, monthStats, onChangeMonth, onPickDate }: Props) {
  const holidaySet = new Set(config.holidays.map((holiday) => holiday.date));
  const cells = monthGrid(month);

  const cellClass = (date: string) => {
    if (!date) return 'cell empty';
    const record = records.get(date);
    const weekend = weekdayLabel(date) === '周六' || weekdayLabel(date) === '周日';
    if (holidaySet.has(date)) return 'cell holiday';
    if (record?.status === 'leave') return date > config.today ? 'cell leave upcoming' : 'cell leave';
    if (record?.status === 'present') return 'cell present';
    if (weekend) return 'cell holiday';
    if (date === config.today) return 'cell today';
    if (date > config.today) return 'cell future';
    return 'cell missing';
  };

  return (
    <div className="stack">
      <header className="page-head month-head">
        <button type="button" className="ghost" onClick={() => onChangeMonth(shiftMonth(month, -1))}>
          ←
        </button>
        <h1>{monthLabel(month)}</h1>
        <button type="button" className="ghost" onClick={() => onChangeMonth(shiftMonth(month, 1))}>
          →
        </button>
      </header>

      {monthStats ? (
        <p className="muted small center-text">
          出勤 {monthStats.present} · 请假 {monthStats.leave} · 未记录 {monthStats.unrecorded}
        </p>
      ) : null}

      <section className="card calendar">
        <div className="week-head">
          {WEEK_HEADS.map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>
        <div className="grid">
          {cells.map((date, index) => (
            <button
              key={`${month}-${index}`}
              type="button"
              className={cellClass(date)}
              disabled={!date}
              onClick={() => date && onPickDate(date)}
            >
              {date ? Number(date.slice(8)) : ''}
            </button>
          ))}
        </div>
      </section>

      <div className="legend">
        <span>
          <i className="dot present" />
          出勤
        </span>
        <span>
          <i className="dot leave" />
          请假
        </span>
        <span>
          <i className="dot holiday" />
          周末 / 节假日
        </span>
        <span>
          <i className="dot missing" />
          未记录
        </span>
      </div>

      {monthStats?.unrecordedDates.length ? (
        <p className="muted small">
          这个月还没记录：{monthStats.unrecordedDates.map((date) => shortDate(date)).join('、')}
        </p>
      ) : null}
    </div>
  );
}
