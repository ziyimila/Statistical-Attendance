import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import CalendarView from './CalendarView';
import HomeView from './HomeView';
import LoginView from './LoginView';
import RecordSheet from '../components/RecordSheet';
import SettingsView from './SettingsView';
import StatsView from './StatsView';
import type { AppConfig, AttendanceRecord, StatsResult } from '../types';

const config: AppConfig = {
  today: '2026-09-16',
  tomorrow: '2026-09-17',
  who: '妈妈',
  termIsSeeded: false,
  activeTerm: {
    id: 1,
    name: '2026 秋季学期',
    startDate: '2026-09-07',
    endDate: '2027-01-22',
    isActive: true,
  },
  terms: [{ id: 1, name: '2026 秋季学期', startDate: '2026-09-07', endDate: '2027-01-22', isActive: true }],
  holidays: [{ date: '2026-09-25', label: '中秋节' }],
};

const stats: StatsResult = {
  range: { from: '2026-09-07', to: '2026-09-30' },
  schoolDays: 8,
  presentDays: 5.5,
  leaveDays: 1.5,
  halfDayLeaveCount: 1,
  recordedDays: 7,
  attendanceRate: 5.5 / 7,
  unrecorded: 1,
  unrecordedDates: ['2026-09-08'],
  pendingToday: false,
  schoolDaysRemaining: 9,
  holidayDays: 0,
  upcomingLeaveDates: ['2026-09-17'],
  leaveDetails: [
    {
      date: '2026-09-15',
      weekday: '周二',
      portion: 'morning',
      portionLabel: '只去了上午',
      absentDays: 0.5,
      reason: 'sick',
      reasonLabel: '病假',
      note: '咳嗽',
    },
  ],
  leaveByReason: [{ key: 'sick', label: '病假', days: 1.5 }],
};

const records = new Map<string, AttendanceRecord>([
  [
    '2026-09-15',
    { date: '2026-09-15', portion: 'morning', reason: 'sick', note: '咳嗽', byName: '妈妈' },
  ],
]);

const noop = () => {};

/** 冒烟测试：把每个页面渲染一遍，确保没有运行时报错，也确保关键文案真的画出来了 */
describe('页面渲染', () => {
  it('登录页', () => {
    const html = renderToStaticMarkup(<LoginView onSuccess={noop} />);
    expect(html).toContain('上学打卡');
    expect(html).toContain('家庭口令');
  });

  it('主屏：没打卡时给两个大按钮，并提示要补的日子', () => {
    const html = renderToStaticMarkup(
      <HomeView
        config={config}
        records={records}
        termStats={stats}
        monthStats={stats}
        busy={false}
        onPresent={noop}
        onOpenSheet={noop}
        onGoCalendar={noop}
        onGoSettings={noop}
        onUndoUpcoming={noop}
      />,
    );
    expect(html).toContain('今天去了');
    expect(html).toContain('今天请假');
    expect(html).toContain('9/8 还没记录');
    expect(html).toContain('已提前请假');
    expect(html).toContain('撤销');
  });

  it('主屏：半天也有自己的说法，不是笼统的"请假"', () => {
    const html = renderToStaticMarkup(
      <HomeView
        config={{ ...config, today: '2026-09-15' }}
        records={records}
        termStats={stats}
        monthStats={stats}
        busy={false}
        onPresent={noop}
        onOpenSheet={noop}
        onGoCalendar={noop}
        onGoSettings={noop}
        onUndoUpcoming={noop}
      />,
    );
    expect(html).toContain('今天只去了上午');
    expect(html).toContain('病假');
    expect(html).toContain('改一下');
  });

  it('日历：画出整月的格子、半天用两段色、小计带小数', () => {
    const html = renderToStaticMarkup(
      <CalendarView
        config={config}
        records={records}
        month="2026-09"
        monthStats={stats}
        onChangeMonth={noop}
        onPickDate={noop}
      />,
    );
    expect(html).toContain('2026 年 9 月');
    expect(html).toContain('出勤 5.5 · 缺勤 1.5 · 未记录 1');
    expect(html).toContain('cell half morning');
    expect((html.match(/class="cell/g) ?? []).length).toBeGreaterThanOrEqual(35);
  });

  it('统计：数字、分类小计、明细、导出都在', () => {
    const html = renderToStaticMarkup(
      <StatsView config={config} month="2026-09" monthStats={stats} termStats={stats} records={records} />,
    );
    expect(html).toContain('本学期累计');
    expect(html).toContain('缺勤分类');
    expect(html).toContain('缺勤明细');
    expect(html).toContain('9/15 周二');
    expect(html).toContain('只去了上午');
    // HTML 里 & 会被转义成 &amp;
    expect(html).toContain('/api/export?format=csv&amp;month=2026-09');
    expect(html).toContain('/api/export?format=json');
    expect(html).toContain('全勤率 79%');
    expect(html).toContain('生成学期报告卡');
  });

  it('设置：学期、放假安排、口令、数据恢复', () => {
    const html = renderToStaticMarkup(
      <SettingsView config={config} onReload={async () => {}} onLogout={async () => {}} />,
    );
    expect(html).toContain('当前学期');
    expect(html).toContain('2026/09/25');
    expect(html).toContain('保存口令');
    expect(html).toContain('选择备份文件导入');
  });

  it('面板：四个状态可选，选半天时不问"请几天"', () => {
    const html = renderToStaticMarkup(
      <RecordSheet
        date="2026-09-16"
        record={null}
        config={config}
        busy={false}
        isHoliday={false}
        onClose={noop}
        onSave={async () => {}}
        onDelete={async () => {}}
        onToggleHoliday={async () => {}}
      />,
    );
    expect(html).toContain('全天在园');
    expect(html).toContain('只去了上午');
    expect(html).toContain('只去了下午');
    expect(html).toContain('病假');
    expect(html).toContain('请几天');
    expect(html).toContain('这天园里放假');
  });

  it('面板：放假的日子不再问出勤', () => {
    const html = renderToStaticMarkup(
      <RecordSheet
        date="2026-09-25"
        record={null}
        config={config}
        busy={false}
        isHoliday
        onClose={noop}
        onSave={async () => {}}
        onDelete={async () => {}}
        onToggleHoliday={async () => {}}
      />,
    );
    expect(html).toContain('这天标记为园里放假');
    expect(html).toContain('取消放假');
    expect(html).not.toContain('只去了上午');
  });
});
