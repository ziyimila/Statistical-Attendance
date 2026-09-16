import Icon from '../components/Icon';
import Stat from '../components/Stat';
import { addDays, isWeekend, shortDate } from '../dates';
import {
  formatDays,
  formatRate,
  LEAVE_REASON_LABELS,
  PORTION_LABELS,
  type AppConfig,
  type AttendanceRecord,
  type StatsResult,
} from '../types';

interface Props {
  config: AppConfig;
  records: Map<string, AttendanceRecord>;
  termStats: StatsResult | null;
  monthStats: StatsResult | null;
  busy: boolean;
  onPresent: (date: string) => void;
  onOpenSheet: (date: string) => void;
  onGoCalendar: () => void;
  onUndoUpcoming: () => void;
}

const WEEKDAY_CHARS = '日一二三四五六';

export default function HomeView({
  config,
  records,
  termStats,
  monthStats,
  busy,
  onPresent,
  onOpenSheet,
  onGoCalendar,
  onUndoUpcoming,
}: Props) {
  const today = config.today;
  const record = records.get(today) ?? null;
  const holidaySet = new Set(config.holidays.map((holiday) => holiday.date));
  const upcoming = termStats?.upcomingLeaveDates ?? [];
  const missing = monthStats?.unrecordedDates ?? [];
  const streak = presentStreak(records, today, holidaySet);
  const term = config.activeTerm;

  const [, monthText, dayText] = today.split('-').map(Number);
  const weekday = `周${WEEKDAY_CHARS[new Date(`${today}T00:00:00`).getDay()]}`;

  return (
    <div className="stack">
      <header className="topbar">
        <div>
          <h1>
            {monthText} 月 {dayText} 日 {weekday}
          </h1>
          <p className="sub">{term ? `${term.name} · 第 ${weekOf(term.startDate, today)} 周` : '还没有设置学期'}</p>
        </div>
        <div className="who" title="当前身份">
          {config.who?.slice(-1) ?? '·'}
        </div>
      </header>

      {missing.length > 0 ? (
        <button type="button" className="notice warn" onClick={onGoCalendar}>
          <Icon name="alert" size={19} />
          <span>{missing.map((date) => shortDate(date)).join('、')} 还没记录，点这里补</span>
        </button>
      ) : null}

      {upcoming.length > 0 ? (
        <div className="notice calm">
          <Icon name="calendarMinus" size={19} />
          <span>已提前请假：{upcoming.map((date) => shortDate(date)).join('、')}</span>
          <button type="button" className="btn btn-ghost tiny-text" onClick={onUndoUpcoming}>
            撤销
          </button>
        </div>
      ) : null}

      <section className="card today">
        <div className="today-head">
          <i className={record ? `dot ${toneOf(record)}` : 'dot'} />
          <span className="label">{record ? '今天的记录' : '今日打卡'}</span>
          <span className="when">{record?.byName ? `${record.byName}记的` : '点一下就好'}</span>
        </div>

        {record ? (
          <>
            <div className="hero-status">
              <div className={`hero-badge ${toneOf(record)}`}>
                <Icon name={record.portion === 'full' ? 'check' : 'calendarMinus'} size={26} />
              </div>
              <div className="hero-text">
                <strong>{heroTitle(record)}</strong>
                <span>
                  {record.portion !== 'full'
                    ? `${record.reason ? LEAVE_REASON_LABELS[record.reason] : '请假'}${
                        record.note ? ` · ${record.note}` : ''
                      }`
                    : '真好，继续攒天数'}
                </span>
              </div>
            </div>
            {streak >= 2 ? (
              <span className="streak">
                <Icon name="check" size={14} />
                连续出勤 {streak} 天
              </span>
            ) : null}
            <button type="button" className="btn btn-soft" onClick={() => onOpenSheet(today)}>
              改一下
            </button>
          </>
        ) : (
          <>
            <div className="hero-status">
              <div className="hero-badge idle">
                <Icon name="clock" size={26} />
              </div>
              <div className="hero-text">
                <strong>今天还没打卡</strong>
                <span>去上学点左边，请假点右边</span>
              </div>
            </div>
            <div className="big-actions">
              <button type="button" className="big present" disabled={busy} onClick={() => onPresent(today)}>
                <Icon name="check" size={26} />
                今天去了
              </button>
              <button type="button" className="big leave" disabled={busy} onClick={() => onOpenSheet(today)}>
                <Icon name="calendarMinus" size={26} />
                今天请假
              </button>
            </div>
          </>
        )}
      </section>

      <section className="card">
        <div className="card-head">
          <span className="card-title">本学期</span>
          {term ? (
            <span className="muted tiny-text">距学期结束还有 {daysBetween(today, term.endDate)} 天</span>
          ) : null}
        </div>

        {termStats ? (
          <>
            <div className="stats-row">
              <Stat label="出勤" value={formatDays(termStats.presentDays)} tone="present" />
              <Stat label="缺勤" value={formatDays(termStats.leaveDays)} tone="leave" />
              <Stat label="未记录" value={String(termStats.unrecorded)} tone="muted" />
            </div>
            <div className="progress">
              <i style={{ width: `${progressOf(termStats)}%` }} />
            </div>
            <div className="progress-row">
              <span>已过 {termStats.schoolDays} 个上学日</span>
              <span>还剩 {termStats.schoolDaysRemaining} 天</span>
            </div>
            <p className="muted tiny-text">
              全勤率 {formatRate(termStats.attendanceRate)}（按已记录的 {formatDays(termStats.recordedDays)} 天算）
            </p>
            {termStats.holidayDays > 0 ? (
              <p className="muted tiny-text">另有 {termStats.holidayDays} 天园里放假，不算缺勤</p>
            ) : null}
          </>
        ) : (
          <div className="empty-state">
            <div className="badge">
              <Icon name="chart" size={20} />
            </div>
            <p className="small">还没有统计数据</p>
          </div>
        )}
      </section>
    </div>
  );
}

function progressOf(stats: StatsResult): number {
  const total = stats.schoolDays + stats.schoolDaysRemaining;
  return total === 0 ? 0 : Math.round((stats.schoolDays / total) * 100);
}

function heroTitle(record: AttendanceRecord): string {
  if (record.portion === 'full') return '今天去上学了';
  if (record.portion === 'absent') return '今天请假';
  return `今天${PORTION_LABELS[record.portion]}`;
}

/** 全天在园和只去半天都用绿色，全天没去用黄色 */
function toneOf(record: AttendanceRecord): 'present' | 'leave' {
  return record.portion === 'absent' ? 'leave' : 'present';
}

function timestamp(value: string): number {
  return new Date(`${value}T00:00:00`).getTime();
}

function weekOf(termStart: string, today: string): number {
  const days = Math.floor((timestamp(today) - timestamp(termStart)) / 86_400_000);
  return Math.max(1, Math.floor(days / 7) + 1);
}

function daysBetween(from: string, to: string): number {
  return Math.max(0, Math.round((timestamp(to) - timestamp(from)) / 86_400_000));
}

/** 连续出勤：从今天往回数，遇到请假或没打卡就停；今天还没打卡时不打断之前的连续 */
function presentStreak(records: Map<string, AttendanceRecord>, today: string, holidays: Set<string>): number {
  let streak = 0;
  let cursor = records.get(today) ? today : addDays(today, -1);
  for (let step = 0; step < 400; step += 1) {
    if (isWeekend(cursor) || holidays.has(cursor)) {
      cursor = addDays(cursor, -1);
      continue;
    }
    if (records.get(cursor)?.portion === 'full') {
      streak += 1;
      cursor = addDays(cursor, -1);
      continue;
    }
    break;
  }
  return streak;
}
