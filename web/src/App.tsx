import { useCallback, useEffect, useState } from 'react';
import { UnauthorizedError, api, type RecordPayload } from './api';
import Icon, { type IconName } from './components/Icon';
import RecordSheet from './components/RecordSheet';
import CalendarView from './views/CalendarView';
import HomeView from './views/HomeView';
import LoginView from './views/LoginView';
import SettingsView from './views/SettingsView';
import StatsView from './views/StatsView';
import type { AppConfig, AttendanceRecord, StatsResult } from './types';

type Tab = 'home' | 'calendar' | 'stats' | 'settings';

const TABS: Array<{ key: Tab; label: string; icon: IconName }> = [
  { key: 'home', label: '打卡', icon: 'check' },
  { key: 'calendar', label: '日历', icon: 'calendar' },
  { key: 'stats', label: '统计', icon: 'chart' },
  { key: 'settings', label: '设置', icon: 'settings' },
];

/** 刚刚改动的那些天，用来支持"撤销" */
interface UndoState {
  entries: Array<{ date: string; previous: AttendanceRecord | null }>;
}

export default function App() {
  const [phase, setPhase] = useState<'loading' | 'login' | 'ready'>('loading');
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [records, setRecords] = useState<Map<string, AttendanceRecord>>(new Map());
  const [monthStats, setMonthStats] = useState<StatsResult | null>(null);
  const [termStats, setTermStats] = useState<StatsResult | null>(null);
  const [month, setMonth] = useState('');
  const [tab, setTab] = useState<Tab>('home');
  const [sheetDate, setSheetDate] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [undo, setUndo] = useState<UndoState | null>(null);
  const [busy, setBusy] = useState(false);

  const refreshStats = useCallback(async (targetMonth: string) => {
    if (!targetMonth) return;
    const [monthly, whole] = await Promise.all([api.stats('month', targetMonth), api.stats('term')]);
    setMonthStats(monthly);
    setTermStats(whole);
  }, []);

  const bootstrap = useCallback(async () => {
    try {
      const cfg = await api.getConfig();
      setConfig(cfg);
      const bounds = cfg.activeTerm
        ? { from: cfg.activeTerm.startDate, to: cfg.activeTerm.endDate }
        : { from: cfg.today, to: cfg.today };
      const list = await api.listRecords(bounds.from, bounds.to);
      setRecords(new Map(list.map((record) => [record.date, record])));
      const activeMonth = cfg.today.slice(0, 7);
      setMonth(activeMonth);
      await refreshStats(activeMonth);
      setPhase('ready');
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        setPhase('login');
        return;
      }
      setToast(error instanceof Error ? error.message : '加载失败');
      setPhase('login');
    }
  }, [refreshStats]);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(
      () => {
        setToast(null);
        setUndo(null);
      },
      undo ? 5000 : 2600,
    );
    return () => clearTimeout(timer);
  }, [toast, undo]);

  const save = async (dates: string[], payload: RecordPayload, message: string) => {
    setBusy(true);
    const entries = dates.map((date) => ({ date, previous: records.get(date) ?? null }));
    try {
      const saved =
        dates.length === 1 ? [await api.upsertRecord(dates[0], payload)] : await api.bulkRecords(dates, payload);
      setRecords((previous) => {
        const next = new Map(previous);
        for (const record of saved) next.set(record.date, record);
        return next;
      });
      setSheetDate(null);
      setUndo({ entries });
      setToast(message);
      await refreshStats(month);
    } catch (error) {
      setToast(error instanceof Error ? error.message : '保存失败');
    } finally {
      setBusy(false);
    }
  };

  const clear = async (date: string) => {
    setBusy(true);
    const entries = [{ date, previous: records.get(date) ?? null }];
    try {
      await api.deleteRecord(date);
      setRecords((previous) => {
        const next = new Map(previous);
        next.delete(date);
        return next;
      });
      setSheetDate(null);
      setUndo({ entries });
      setToast('这条记录已经删掉');
      await refreshStats(month);
    } catch (error) {
      setToast(error instanceof Error ? error.message : '删除失败');
    } finally {
      setBusy(false);
    }
  };

  /** 刚点错了：把刚才那几天恢复成改动前的样子 */
  const undoLast = async () => {
    if (!undo) return;
    setBusy(true);
    try {
      for (const entry of undo.entries) {
        if (entry.previous) {
          await api.upsertRecord(entry.date, {
            portion: entry.previous.portion,
            reason: entry.previous.reason,
            note: entry.previous.note,
          });
        } else {
          await api.deleteRecord(entry.date);
        }
      }
      setUndo(null);
      setToast('已撤销');
      await bootstrap();
    } catch (error) {
      setToast(error instanceof Error ? error.message : '撤销失败');
    } finally {
      setBusy(false);
    }
  };

  /** 提前请了假但后来不用请了：一次把还没发生的都撤掉 */
  const undoUpcoming = async () => {
    const dates = termStats?.upcomingLeaveDates ?? [];
    if (dates.length === 0) return;
    setBusy(true);
    const entries = dates.map((date) => ({ date, previous: records.get(date) ?? null }));
    try {
      await api.deleteRecords(dates);
      setUndo({ entries });
      setToast(`已撤销 ${dates.length} 天请假`);
      await bootstrap();
    } catch (error) {
      setToast(error instanceof Error ? error.message : '撤销失败');
    } finally {
      setBusy(false);
    }
  };

  const toggleHoliday = async (date: string) => {
    setBusy(true);
    try {
      const existing = config?.holidays.some((holiday) => holiday.date === date);
      if (existing) await api.deleteHoliday(date);
      else await api.addHoliday(date, '园里放假');
      setSheetDate(null);
      setUndo(null);
      await bootstrap();
      setToast(existing ? '已恢复成上学日' : '这天标记为园里放假');
    } catch (error) {
      setToast(error instanceof Error ? error.message : '操作失败');
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    await api.logout();
    setConfig(null);
    setRecords(new Map());
    setPhase('login');
  };

  if (phase === 'loading') {
    return (
      <div className="app">
        <main className="screen">
          <div className="stack">
            <div className="skeleton skeleton-short" />
            <div className="skeleton skeleton-tall" />
            <div className="skeleton skeleton-short" />
          </div>
        </main>
      </div>
    );
  }

  if (phase === 'login') {
    return (
      <>
        <LoginView
          onSuccess={() => {
            setPhase('loading');
            void bootstrap();
          }}
        />
        {toast ? <Toast message={toast} /> : null}
      </>
    );
  }

  if (!config) return null;

  return (
    <div className="app">
      <main className="screen">
        {tab === 'home' ? (
          <HomeView
            config={config}
            records={records}
            termStats={termStats}
            monthStats={monthStats}
            busy={busy}
            onPresent={(date) => void save([date], { portion: 'full' }, '记好了，今天去上学')}
            onOpenSheet={setSheetDate}
            onGoCalendar={() => setTab('calendar')}
            onGoSettings={() => setTab('settings')}
            onUndoUpcoming={() => void undoUpcoming()}
          />
        ) : null}

        {tab === 'calendar' ? (
          <CalendarView
            config={config}
            records={records}
            month={month}
            monthStats={monthStats}
            onChangeMonth={setMonth}
            onPickDate={setSheetDate}
          />
        ) : null}

        {tab === 'stats' ? (
          <StatsView
            config={config}
            month={month}
            monthStats={monthStats}
            termStats={termStats}
            records={records}
          />
        ) : null}

        {tab === 'settings' ? (
          <SettingsView
            config={config}
            onReload={async () => {
              await bootstrap();
              setToast('已更新');
            }}
            onLogout={logout}
          />
        ) : null}
      </main>

      <nav className="tabbar">
        <div className="tabbar-inner">
          {TABS.map((item) => (
            <button
              key={item.key}
              type="button"
              className={tab === item.key ? 'tab active' : 'tab'}
              onClick={() => setTab(item.key)}
            >
              <Icon name={item.icon} size={21} />
              {item.label}
            </button>
          ))}
        </div>
      </nav>

      {sheetDate ? (
        <RecordSheet
          date={sheetDate}
          record={records.get(sheetDate) ?? null}
          config={config}
          busy={busy}
          isHoliday={config.holidays.some((holiday) => holiday.date === sheetDate)}
          onClose={() => setSheetDate(null)}
          onSave={save}
          onDelete={clear}
          onToggleHoliday={toggleHoliday}
        />
      ) : null}

      {toast ? <Toast message={toast} onUndo={undo ? () => void undoLast() : undefined} /> : null}
    </div>
  );
}

function Toast({ message, onUndo }: { message: string; onUndo?: () => void }) {
  return (
    <div className="toast">
      <Icon name="check" size={17} />
      <span>{message}</span>
      {onUndo ? (
        <button type="button" className="toast-action" onClick={onUndo}>
          撤销
        </button>
      ) : null}
    </div>
  );
}
