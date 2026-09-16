import { fullDate, shortDate } from '../dates';
import { LEAVE_REASON_LABELS, type AppConfig, type AttendanceRecord, type StatsResult } from '../types';

interface Props {
  config: AppConfig;
  records: Map<string, AttendanceRecord>;
  termStats: StatsResult | null;
  monthStats: StatsResult | null;
  busy: boolean;
  onPresent: (date: string) => void;
  onOpenSheet: (date: string) => void;
  onGoCalendar: () => void;
}

export default function HomeView({
  config,
  records,
  termStats,
  monthStats,
  busy,
  onPresent,
  onOpenSheet,
  onGoCalendar,
}: Props) {
  const today = config.today;
  const record = records.get(today) ?? null;
  const upcoming = termStats?.upcomingLeaveDates ?? [];
  const missing = monthStats?.unrecordedDates ?? [];

  return (
    <div className="stack">
      <header className="page-head">
        <h1>{fullDate(today)}</h1>
        <p className="muted small">今天是小班第几天不重要，记下来就行</p>
      </header>

      {missing.length > 0 ? (
        <button type="button" className="notice" onClick={onGoCalendar}>
          {missing.map((date) => shortDate(date)).join('、')} 还没记录，点这里补
        </button>
      ) : null}

      {upcoming.length > 0 ? (
        <div className="notice quiet">
          已提前请假：{upcoming.map((date) => shortDate(date)).join('、')}
        </div>
      ) : null}

      <section className="card today">
        {record ? (
          <>
            <div className={record.status === 'present' ? 'stamp present' : 'stamp leave'}>
              {record.status === 'present' ? '今天去上学了' : '今天请假'}
            </div>
            {record.status === 'leave' ? (
              <p className="muted small">
                {record.reason ? LEAVE_REASON_LABELS[record.reason] : '请假'}
                {record.note ? ` · ${record.note}` : ''}
              </p>
            ) : null}
            <button type="button" className="ghost" onClick={() => onOpenSheet(today)}>
              改一下
            </button>
          </>
        ) : (
          <>
            <p className="muted small">今天还没打卡</p>
            <div className="big-actions">
              <button type="button" className="big present" disabled={busy} onClick={() => onPresent(today)}>
                <span aria-hidden>🎒</span>
                今天去了
              </button>
              <button type="button" className="big leave" disabled={busy} onClick={() => onOpenSheet(today)}>
                <span aria-hidden>🤒</span>
                今天请假
              </button>
            </div>
          </>
        )}
      </section>

      <section className="card">
        <h2 className="card-title">本学期</h2>
        {termStats ? (
          <div className="numbers">
            <Number label="出勤" value={termStats.present} tone="present" />
            <Number label="请假" value={termStats.leave} tone="leave" />
            <Number label="未记录" value={termStats.unrecorded} tone="muted" />
          </div>
        ) : (
          <p className="muted small">还没有统计数据</p>
        )}
        {termStats ? (
          <p className="muted small">
            应上学 {termStats.schoolDays} 天已过，还剩 {termStats.schoolDaysRemaining} 天
          </p>
        ) : null}
      </section>
    </div>
  );
}

export function Number({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className={`number ${tone}`}>
      <strong>{value}</strong>
      <span className="muted small">{label}</span>
    </div>
  );
}
