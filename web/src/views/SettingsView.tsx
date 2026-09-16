import { useState } from 'react';
import { api } from '../api';
import { weekdayLabel } from '../dates';
import type { AppConfig } from '../types';

interface Props {
  config: AppConfig;
  onReload: () => Promise<void>;
  onLogout: () => Promise<void>;
}

export default function SettingsView({ config, onReload, onLogout }: Props) {
  const [message, setMessage] = useState<string | null>(null);
  const [holidayDate, setHolidayDate] = useState('');
  const [holidayLabel, setHolidayLabel] = useState('');
  const [passcode, setPasscode] = useState('');
  const [newTerm, setNewTerm] = useState({ name: '', startDate: '', endDate: '' });

  const run = async (action: () => Promise<void>, ok: string) => {
    try {
      await action();
      setMessage(ok);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '操作失败');
    }
  };

  return (
    <div className="stack">
      <header className="page-head">
        <h1>设置</h1>
        <p className="muted small">当前身份：{config.who ?? '未知'}</p>
      </header>

      {message ? <div className="notice quiet">{message}</div> : null}

      <section className="card">
        <h2 className="card-title">学期</h2>
        {config.terms.map((term) => (
          <TermRow
            key={term.id}
            term={term}
            onSave={async (patch) => {
              await run(async () => {
                await api.updateTerm(term.id, patch);
                await onReload();
              }, '学期已更新');
            }}
          />
        ))}

        <details className="more">
          <summary>新增一个学期</summary>
          <input
            className="input"
            placeholder="名称，例如 2027 春季学期"
            value={newTerm.name}
            onChange={(event) => setNewTerm({ ...newTerm, name: event.target.value })}
          />
          <div className="row">
            <input
              className="input"
              type="date"
              value={newTerm.startDate}
              onChange={(event) => setNewTerm({ ...newTerm, startDate: event.target.value })}
            />
            <input
              className="input"
              type="date"
              value={newTerm.endDate}
              onChange={(event) => setNewTerm({ ...newTerm, endDate: event.target.value })}
            />
          </div>
          <button
            type="button"
            className="ghost button"
            disabled={!newTerm.name || !newTerm.startDate || !newTerm.endDate}
            onClick={() =>
              void run(async () => {
                await fetch('/api/terms', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(newTerm),
                });
                setNewTerm({ name: '', startDate: '', endDate: '' });
                await onReload();
              }, '学期已新增')
            }
          >
            新增
          </button>
        </details>
      </section>

      <section className="card">
        <h2 className="card-title">节假日</h2>
        <p className="muted small">
          周末自动跳过，这里只填幼儿园另外放假的日子（国庆、元旦、园里活动等）。预填的是国定假期，请按幼儿园通知核对。
        </p>
        <div className="row">
          <input
            className="input"
            type="date"
            value={holidayDate}
            onChange={(event) => setHolidayDate(event.target.value)}
          />
          <input
            className="input"
            placeholder="说明"
            value={holidayLabel}
            onChange={(event) => setHolidayLabel(event.target.value)}
          />
        </div>
        <button
          type="button"
          className="ghost button"
          disabled={!holidayDate}
          onClick={() =>
            void run(async () => {
              await api.addHoliday(holidayDate, holidayLabel || '放假');
              setHolidayDate('');
              setHolidayLabel('');
              await onReload();
            }, '已加上这个放假的日子')
          }
        >
          添加
        </button>

        <ul className="details holidays">
          {config.holidays.map((holiday) => (
            <li key={holiday.date}>
              <span className="detail-date">
                {holiday.date} {weekdayLabel(holiday.date)}
              </span>
              <span className="detail-reason">{holiday.label}</span>
              <button
                type="button"
                className="ghost tiny"
                onClick={() =>
                  void run(async () => {
                    await api.deleteHoliday(holiday.date);
                    await onReload();
                  }, '已删除')
                }
              >
                删除
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h2 className="card-title">我的口令</h2>
        <input
          className="input"
          type="password"
          placeholder="新的口令，至少 4 位"
          value={passcode}
          onChange={(event) => setPasscode(event.target.value)}
        />
        <button
          type="button"
          className="ghost button"
          disabled={passcode.length < 4}
          onClick={() =>
            void run(async () => {
              await api.changePasscode(passcode);
              setPasscode('');
            }, '口令已更新，下次登录用新口令')
          }
        >
          保存口令
        </button>
      </section>

      <section className="card">
        <button type="button" className="danger" onClick={() => void onLogout()}>
          退出登录
        </button>
      </section>
    </div>
  );
}

function TermRow({
  term,
  onSave,
}: {
  term: { id: number; name: string; startDate: string; endDate: string; isActive: boolean };
  onSave: (patch: { name?: string; startDate?: string; endDate?: string; isActive?: boolean }) => Promise<void>;
}) {
  const [start, setStart] = useState(term.startDate);
  const [end, setEnd] = useState(term.endDate);
  const dirty = start !== term.startDate || end !== term.endDate;

  return (
    <div className="term">
      <div className="term-head">
        <strong>{term.name}</strong>
        {term.isActive ? <span className="badge">当前学期</span> : (
          <button type="button" className="ghost tiny" onClick={() => void onSave({ isActive: true })}>
            设为当前
          </button>
        )}
      </div>
      <div className="row">
        <label className="field">
          <span className="muted small">开学日</span>
          <input className="input" type="date" value={start} onChange={(event) => setStart(event.target.value)} />
        </label>
        <label className="field">
          <span className="muted small">结束日</span>
          <input className="input" type="date" value={end} onChange={(event) => setEnd(event.target.value)} />
        </label>
      </div>
      {dirty ? (
        <button type="button" className="primary small-button" onClick={() => void onSave({ startDate: start, endDate: end })}>
          保存学期日期
        </button>
      ) : null}
    </div>
  );
}
