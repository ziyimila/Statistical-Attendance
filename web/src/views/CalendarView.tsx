import Icon from '../components/Icon';
import { monthGrid, monthLabel, shiftMonth, shortDate, weekdayLabel } from '../dates';
import { formatDays, type AppConfig, type AttendanceRecord, type StatsResult } from '../types';

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
  const isThisMonth = month === config.today.slice(0, 7);

  const cellClass = (date: string) => {
    if (!date) return 'cell empty';
    const record = records.get(date);
    const weekend = weekdayLabel(date) === '周六' || weekdayLabel(date) === '周日';
    const classes = ['cell'];
    if (holidaySet.has(date)) classes.push('holiday');
    else if (record?.portion === 'absent') classes.push(date > config.today ? 'leave upcoming' : 'leave');
    else if (record?.portion === 'morning') classes.push('half morning');
    else if (record?.portion === 'afternoon') classes.push('half afternoon');
    else if (record?.portion === 'full') classes.push('present');
    else if (weekend) classes.push('holiday');
    else if (date > config.today) classes.push('future');
    else classes.push('missing');
    if (date === config.today) classes.push('today');
    return classes.join(' ');
  };

  return (
    <div className="stack">
      <header className="month-head">
        <button
          type="button"
          className="icon-btn"
          aria-label="上个月"
          onClick={() => onChangeMonth(shiftMonth(month, -1))}
        >
          <Icon name="chevronLeft" size={20} />
        </button>
        <h1>{monthLabel(month)}</h1>
        <button
          type="button"
          className="icon-btn"
          aria-label="下个月"
          onClick={() => onChangeMonth(shiftMonth(month, 1))}
        >
          <Icon name="chevronRight" size={20} />
        </button>
      </header>

      <section className="card">
        <div className="card-head">
          <span className="card-title">
            出勤 {formatDays(monthStats?.presentDays ?? 0)} · 缺勤 {formatDays(monthStats?.leaveDays ?? 0)} · 未记录{' '}
            {monthStats?.unrecorded ?? 0}
          </span>
          {!isThisMonth ? (
            <button
              type="button"
              className="btn btn-ghost tiny-text"
              onClick={() => onChangeMonth(config.today.slice(0, 7))}
            >
              回到本月
            </button>
          ) : null}
        </div>

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
          <i className="swatch present" />
          出勤
        </span>
        <span>
          <i className="swatch leave" />
          全天没去
        </span>
        <span>
          <i className="swatch half" />
          只去半天
        </span>
        <span>
          <i className="swatch holiday" />
          周末 / 节假日
        </span>
        <span>
          <i className="swatch missing" />
          未记录
        </span>
      </div>

      {monthStats?.unrecordedDates.length ? (
        <div className="notice calm">
          <Icon name="alert" size={19} />
          <span>这个月还没记录：{monthStats.unrecordedDates.map((date) => shortDate(date)).join('、')}</span>
        </div>
      ) : null}
    </div>
  );
}
