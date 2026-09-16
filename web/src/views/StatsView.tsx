import Icon from '../components/Icon';
import Stat from '../components/Stat';
import { shortDate } from '../dates';
import type { AppConfig, StatsResult } from '../types';

interface Props {
  config: AppConfig;
  month: string;
  monthStats: StatsResult | null;
  termStats: StatsResult | null;
}

export default function StatsView({ config, month, monthStats, termStats }: Props) {
  return (
    <div className="stack">
      <header className="topbar">
        <div>
          <h1>统计</h1>
          <p className="sub">{config.activeTerm?.name ?? '还没设置学期'}</p>
        </div>
      </header>

      <section className="card">
        <div className="card-head">
          <span className="card-title">
            本月<span className="hint">{month.replace('-', ' 年 ')} 月</span>
          </span>
        </div>
        {monthStats ? (
          <>
            <div className="stats-row">
              <Stat label="出勤" value={monthStats.present} tone="present" />
              <Stat label="请假" value={monthStats.leave} tone="leave" />
              <Stat label="未记录" value={monthStats.unrecorded} tone="muted" />
            </div>
            <div className="progress">
              <i style={{ width: `${progressOf(monthStats)}%` }} />
            </div>
            <div className="progress-row">
              <span>应上学 {monthStats.schoolDays} 天（截至今天）</span>
              <span>还剩 {monthStats.schoolDaysRemaining} 天</span>
            </div>
          </>
        ) : (
          <EmptyState text="这个月还没有数据" />
        )}
      </section>

      <section className="card">
        <div className="card-head">
          <span className="card-title">
            本学期累计
            {config.activeTerm ? (
              <span className="hint">
                {config.activeTerm.startDate.slice(5).replace('-', '/')} —
                {config.activeTerm.endDate.slice(5).replace('-', '/')}
              </span>
            ) : null}
          </span>
        </div>
        {termStats ? (
          <>
            <div className="stats-row">
              <Stat label="出勤" value={termStats.present} tone="present" />
              <Stat label="请假" value={termStats.leave} tone="leave" />
              <Stat label="未记录" value={termStats.unrecorded} tone="muted" />
            </div>
            <div className="progress">
              <i style={{ width: `${progressOf(termStats)}%` }} />
            </div>
            <div className="progress-row">
              <span>开学至今 {termStats.schoolDays} 个上学日</span>
              <span>还剩 {termStats.schoolDaysRemaining} 天</span>
            </div>
          </>
        ) : (
          <EmptyState text="还没有统计数据" />
        )}
      </section>

      <section className="card">
        <div className="card-head">
          <span className="card-title">请假明细</span>
          <span className="muted tiny-text">
            {termStats ? `共 ${termStats.leaveDetails.length} 天` : ''}
          </span>
        </div>
        {termStats?.leaveDetails.length ? (
          <ul className="list">
            {termStats.leaveDetails.map((detail) => (
              <li key={detail.date}>
                <span className="date">
                  {shortDate(detail.date)} {detail.weekday}
                </span>
                <span className="tag leave">{detail.reasonLabel}</span>
                {detail.note ? <span className="note">{detail.note}</span> : null}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState text="这个学期还没有请假记录" />
        )}
      </section>

      <section className="card">
        <div className="card-head">
          <span className="card-title">
            导出备份<span className="hint">导出的是全部记录</span>
          </span>
        </div>
        <div className="row">
          <a className="btn btn-soft" style={{ flex: 1 }} href="/api/export?format=csv">
            <Icon name="download" size={18} />
            CSV
          </a>
          <a className="btn btn-soft" style={{ flex: 1 }} href="/api/export?format=json">
            <Icon name="download" size={18} />
            JSON
          </a>
        </div>
        <p className="muted tiny-text">CSV 可以直接用 Excel 打开</p>
      </section>
    </div>
  );
}

function progressOf(stats: StatsResult): number {
  const total = stats.schoolDays + stats.schoolDaysRemaining;
  return total === 0 ? 0 : Math.round((stats.schoolDays / total) * 100);
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="empty-state">
      <div className="badge">
        <Icon name="calendarMinus" size={20} />
      </div>
      <p className="small">{text}</p>
    </div>
  );
}
