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
  present: 5,
  leave: 2,
  unrecorded: 1,
  unrecordedDates: ['2026-09-08'],
  pendingToday: false,
  schoolDaysRemaining: 9,
  upcomingLeaveDates: ['2026-09-17'],
  leaveDetails: [
    { date: '2026-09-15', weekday: '周二', reason: 'sick', reasonLabel: '病假', note: '咳嗽' },
  ],
};

const records = new Map<string, AttendanceRecord>([
  ['2026-09-15', { date: '2026-09-15', status: 'leave', reason: 'sick', note: '咳嗽', byName: '妈妈' }],
]);

const noop = () => {};

/** 冒烟测试：把每个页面渲染一遍，确保没有运行时报错，也确保关键文案真的画出来了 */
describe('页面渲染', () => {
  it('登录页', () => {
    const html = renderToStaticMarkup(<LoginView onSuccess={noop} />);
    expect(html).toContain('上学打卡');
    expect(html).toContain('家庭口令');
  });

  it('主屏：没打卡时给两个大按钮', () => {
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
      />,
    );
    expect(html).toContain('今天去了');
    expect(html).toContain('今天请假');
    expect(html).toContain('9/8 还没记录');
    expect(html).toContain('已提前请假');
  });

  it('主屏：打过分时显示状态和"改一下"', () => {
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
      />,
    );
    expect(html).toContain('今天请假');
    expect(html).toContain('病假');
    expect(html).toContain('改一下');
  });

  it('日历：画出整月的格子和小计', () => {
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
    expect(html).toContain('出勤 5 · 请假 2 · 未记录 1');
    expect((html.match(/class="cell/g) ?? []).length).toBeGreaterThanOrEqual(35);
  });

  it('统计：数字、明细、导出按钮都在', () => {
    const html = renderToStaticMarkup(
      <StatsView config={config} month="2026-09" monthStats={stats} termStats={stats} />,
    );
    expect(html).toContain('本学期累计');
    expect(html).toContain('请假明细');
    expect(html).toContain('9/15 周二');
    expect(html).toContain('/api/export?format=csv');
  });

  it('设置：学期、节假日、口令', () => {
    const html = renderToStaticMarkup(
      <SettingsView config={config} onReload={async () => {}} onLogout={async () => {}} />,
    );
    expect(html).toContain('当前学期');
    expect(html).toContain('2026-09-25');
    expect(html).toContain('保存口令');
  });

  it('请假面板：默认选病假，可以一次请几天', () => {
    const html = renderToStaticMarkup(
      <RecordSheet
        date="2026-09-16"
        record={null}
        config={config}
        busy={false}
        onClose={noop}
        onSave={async () => {}}
        onDelete={async () => {}}
      />,
    );
    expect(html).toContain('病假');
    expect(html).toContain('请几天');
    expect(html).toContain('去上学了');
  });
});
