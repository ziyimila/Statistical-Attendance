import { useCallback, useEffect, useState } from 'react';
import { UnauthorizedError, api, type RecordPayload } from './api';
import RecordSheet from './components/RecordSheet';
import CalendarView from './views/CalendarView';
import HomeView from './views/HomeView';
import LoginView from './views/LoginView';
import SettingsView from './views/SettingsView';
import StatsView from './views/StatsView';
import type { AppConfig, AttendanceRecord, StatsResult } from './types';

type Tab = 'home' | 'calendar' | 'stats' | 'settings';

const TABS: Array<{ key: Tab; label: string; icon: string }> = [
  { key: 'home', label: '打卡', icon: '✅' },
  { key: 'calendar', label: '日历', icon: '🗓' },
  { key: 'stats', label: '统计', icon: '📊' },
  { key: 'settings', label: '设置', icon: '⚙️' },
];

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
    const timer = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(timer);
  }, [toast]);

  const save = async (dates: string[], payload: RecordPayload, message: string) => {
    setBusy(true);
    try {
      const saved =
        dates.length === 1 ? [await api.upsertRecord(dates[0], payload)] : await api.bulkRecords(dates, payload);
      setRecords((previous) => {
        const next = new Map(previous);
        for (const record of saved) next.set(record.date, record);
        return next;
      });
      setSheetDate(null);
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
    try {
      await api.deleteRecord(date);
      setRecords((previous) => {
        const next = new Map(previous);
        next.delete(date);
        return next;
      });
      setSheetDate(null);
      setToast('这条记录已经删掉');
      await refreshStats(month);
    } catch (error) {
      setToast(error instanceof Error ? error.message : '删除失败');
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
    return <div className="screen center muted">正在打开…</div>;
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
        {toast ? <div className="toast">{toast}</div> : null}
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
            onPresent={(date) => void save([date], { status: 'present' }, '记好了，今天去上学')}
            onOpenSheet={setSheetDate}
            onGoCalendar={() => setTab('calendar')}
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
          <StatsView config={config} month={month} monthStats={monthStats} termStats={termStats} />
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
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            className={tab === item.key ? 'tab active' : 'tab'}
            onClick={() => setTab(item.key)}
          >
            <span aria-hidden>{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>

      {sheetDate ? (
        <RecordSheet
          date={sheetDate}
          record={records.get(sheetDate) ?? null}
          config={config}
          busy={busy}
          onClose={() => setSheetDate(null)}
          onSave={save}
          onDelete={clear}
        />
      ) : null}

      {toast ? <div className="toast">{toast}</div> : null}
    </div>
  );
}
