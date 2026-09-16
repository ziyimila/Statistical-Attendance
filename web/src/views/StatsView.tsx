import { useState } from 'react';
import Icon from '../components/Icon';
import ReportCard from '../components/ReportCard';
import Stat from '../components/Stat';
import { shortDate } from '../dates';
import { formatDays, formatRate, type AppConfig, type AttendanceRecord, type StatsResult } from '../types';

interface Props {
  config: AppConfig;
  month: string;
  monthStats: StatsResult | null;
  termStats: StatsResult | null;
  records: Map<string, AttendanceRecord>;
}

export default function StatsView({ config, month, monthStats, termStats, records }: Props) {
  const [showCard, setShowCard] = useState(false);
  const term = config.activeTerm;

  return (
    <div className="stack">
      <header className="topbar">
        <div>
          <h1>统计</h1>
          <p className="sub">{term?.name ?? '还没设置学期'}</p>
        </div>
      </header>

      {term && termStats ? (
        <button type="button" className="report-entry" onClick={() => setShowCard(true)}>
          <span className="report-entry-icon">
            <Icon name="chart" size={22} />
          </span>
          <span className="report-entry-text">
            <strong>生成学期报告卡</strong>
            <span className="muted tiny-text">一张 3:4 竖图，可以存下来发出去</span>
          </span>
          <Icon name="chevronRight" size={20} />
        </button>
      ) : null}

      <section className="card">
        <div className="card-head">
          <span className="card-title">
            本月<span className="hint">{month.replace('-', ' 年 ')} 月</span>
          </span>
        </div>
        {monthStats ? (
          <>
            <div className="stats-row">
              <Stat label="出勤" value={formatDays(monthStats.presentDays)} tone="present" />
              <Stat label="缺勤" value={formatDays(monthStats.leaveDays)} tone="leave" />
              <Stat label="未记录" value={String(monthStats.unrecorded)} tone="muted" />
            </div>
            <div className="progress">
              <i style={{ width: `${progressOf(monthStats)}%` }} />
            </div>
            <div className="progress-row">
              <span>应上学 {monthStats.schoolDays} 天（截至今天）</span>
              <span>还剩 {monthStats.schoolDaysRemaining} 天</span>
            </div>
            <p className="muted tiny-text">
              全勤率 {formatRate(monthStats.attendanceRate)}（按已记录的 {formatDays(monthStats.recordedDays)} 天算）
            </p>
          </>
        ) : (
          <EmptyState text="这个月还没有数据" />
        )}
      </section>

      <section className="card">
        <div className="card-head">
          <span className="card-title">
            本学期累计
            {term ? (
              <span className="hint">
                {term.startDate.slice(5).replace('-', '/')}—{term.endDate.slice(5).replace('-', '/')}
              </span>
            ) : null}
          </span>
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
              <span>开学至今 {termStats.schoolDays} 个上学日</span>
              <span>还剩 {termStats.schoolDaysRemaining} 天</span>
            </div>
            <p className="muted tiny-text">
              全勤率 {formatRate(termStats.attendanceRate)}（按已记录的 {formatDays(termStats.recordedDays)} 天算）
            </p>
            {termStats.holidayDays > 0 ? (
              <p className="muted tiny-text">
                另有 {termStats.holidayDays} 天园里放假，不计入应上学日、不算缺勤
              </p>
            ) : null}
          </>
        ) : (
          <EmptyState text="还没有统计数据" />
        )}
      </section>

      {termStats && termStats.leaveByReason.length > 0 ? (
        <section className="card">
          <div className="card-head">
            <span className="card-title">
              缺勤分类<span className="hint">含半天，按 0.5 天计</span>
            </span>
          </div>
          <ul className="list">
            {termStats.leaveByReason.map((item) => (
              <li key={item.key}>
                <span className="date">{item.label}</span>
                <span className="tag leave">{formatDays(item.days)} 天</span>
              </li>
            ))}
            {termStats.halfDayLeaveCount > 0 ? (
              <li>
                <span className="date">其中只去半天</span>
                <span className="tag calm">{termStats.halfDayLeaveCount} 次</span>
              </li>
            ) : null}
          </ul>
        </section>
      ) : null}

      <section className="card">
        <div className="card-head">
          <span className="card-title">缺勤明细</span>
          <span className="muted tiny-text">{termStats ? `共 ${formatDays(termStats.leaveDays)} 天` : ''}</span>
        </div>
        {termStats?.leaveDetails.length ? (
          <ul className="list">
            {termStats.leaveDetails.map((detail) => (
              <li key={detail.date}>
                <span className="date">
                  {shortDate(detail.date)} {detail.weekday}
                </span>
                <span className={detail.absentDays === 1 ? 'tag leave' : 'tag half'}>{detail.portionLabel}</span>
                <span className="muted tiny-text">{detail.reasonLabel}</span>
                {detail.note ? <span className="note">{detail.note}</span> : null}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState text="这个学期还没有缺勤记录" />
        )}
      </section>

      <section className="card">
        <div className="card-head">
          <span className="card-title">
            导出<span className="hint">CSV 可直接用 Excel 打开</span>
          </span>
        </div>
        <div className="row">
          <a className="btn btn-soft" style={{ flex: 1 }} href={`/api/export?format=csv&month=${month}`}>
            <Icon name="download" size={18} />
            本月
          </a>
          <a className="btn btn-soft" style={{ flex: 1 }} href="/api/export?format=csv">
            <Icon name="download" size={18} />
            全部
          </a>
          <a className="btn btn-soft" style={{ flex: 1 }} href="/api/export?format=json">
            <Icon name="download" size={18} />
            备份
          </a>
        </div>
        <p className="muted tiny-text">备份是 JSON，可以在设置页导回来恢复数据</p>
      </section>

      {showCard && term && termStats ? (
        <ReportCard
          termName={term.name}
          startDate={term.startDate}
          endDate={term.endDate}
          stats={termStats}
          records={records}
          holidays={new Set(config.holidays.map((holiday) => holiday.date))}
          onClose={() => setShowCard(false)}
        />
      ) : null}
    </div>
  );
}

function progressOf(stats: StatsResult): number {
  const total = stats.schoolDays + stats.schoolDaysRemaining + stats.holidayDays;
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
