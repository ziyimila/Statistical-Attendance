import { shortDate } from '../dates';
import { StatNumber } from './HomeView';
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
      <header className="page-head">
        <h1>统计</h1>
        <p className="muted small">{config.activeTerm?.name ?? '还没设置学期'}</p>
      </header>

      <section className="card">
        <h2 className="card-title">本月</h2>
        {monthStats ? (
          <>
            <div className="numbers">
              <StatNumber label="出勤" value={monthStats.present} tone="present" />
              <StatNumber label="请假" value={monthStats.leave} tone="leave" />
              <StatNumber label="未记录" value={monthStats.unrecorded} tone="muted" />
            </div>
            <p className="muted small">
              本月应上学 {monthStats.schoolDays} 天（截至今天），还剩 {monthStats.schoolDaysRemaining} 天
            </p>
          </>
        ) : (
          <p className="muted small">没有数据</p>
        )}
      </section>

      <section className="card">
        <h2 className="card-title">本学期累计</h2>
        {termStats ? (
          <>
            <div className="numbers">
              <StatNumber label="出勤" value={termStats.present} tone="present" />
              <StatNumber label="请假" value={termStats.leave} tone="leave" />
              <StatNumber label="未记录" value={termStats.unrecorded} tone="muted" />
            </div>
            <p className="muted small">
              开学至今应上学 {termStats.schoolDays} 天，还剩 {termStats.schoolDaysRemaining} 天
            </p>
            {config.activeTerm ? (
              <p className="muted small">
                学期：{shortDate(config.activeTerm.startDate)} — {shortDate(config.activeTerm.endDate)}
              </p>
            ) : null}
          </>
        ) : (
          <p className="muted small">没有数据</p>
        )}
      </section>

      <section className="card">
        <h2 className="card-title">请假明细</h2>
        {termStats?.leaveDetails.length ? (
          <ul className="details">
            {termStats.leaveDetails.map((detail) => (
              <li key={detail.date}>
                <span className="detail-date">
                  {shortDate(detail.date)} {detail.weekday}
                </span>
                <span className="detail-reason">{detail.reasonLabel}</span>
                {detail.note ? <span className="muted small">{detail.note}</span> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted small">这个学期还没有请假记录</p>
        )}
      </section>

      <section className="card export">
        <h2 className="card-title">导出备份</h2>
        <div className="row">
          <a className="ghost button" href="/api/export?format=csv">
            导出 CSV
          </a>
          <a className="ghost button" href="/api/export?format=json">
            导出 JSON
          </a>
        </div>
        <p className="muted small">CSV 可以直接用 Excel 打开（{month} 只是当前查看的月份，导出的是全部记录）</p>
      </section>
    </div>
  );
}
