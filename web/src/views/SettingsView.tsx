import { useState } from 'react';
import { api } from '../api';
import Icon from '../components/Icon';
import { weekdayLabel } from '../dates';
import type { AppConfig, Term } from '../types';

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
  const [importing, setImporting] = useState(false);

  const importBackup = async (file: File) => {
    setImporting(true);
    try {
      const parsed = JSON.parse(await file.text()) as Record<string, unknown>;
      const result = await api.importBackup({
        records: (parsed.records ?? []) as never,
        holidays: (parsed.holidays ?? []) as never,
      });
      setMessage(`已导入 ${result.imported.records} 条记录、${result.imported.holidays} 个放假日`);
      await onReload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '导入失败，检查一下文件是不是这个应用导出的');
    } finally {
      setImporting(false);
    }
  };

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
      <header className="topbar">
        <div>
          <h1>设置</h1>
          <p className="sub">当前身份：{config.who ?? '未知'}</p>
        </div>
      </header>

      {message ? (
        <div className="notice calm">
          <Icon name="check" size={19} />
          <span>{message}</span>
        </div>
      ) : null}

      <p className="group-title">学期</p>
      <section className="card">
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

        <details className="disclosure">
          <summary>
            <Icon name="plus" size={16} />
            新增一个学期
          </summary>
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
            className="btn btn-soft btn-block"
            disabled={!newTerm.name || !newTerm.startDate || !newTerm.endDate}
            onClick={() =>
              void run(async () => {
                await api.createTerm(newTerm);
                setNewTerm({ name: '', startDate: '', endDate: '' });
                await onReload();
              }, '学期已新增')
            }
          >
            新增
          </button>
        </details>
      </section>

      <p className="group-title">放假安排</p>
      <section className="card">
        <p className="muted small">
          周末自动跳过，这里只填幼儿园另外放假的日子。预填的是国定假期，请按老师的通知核对。
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
          className="btn btn-soft btn-block"
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

        <ul className="list">
          {config.holidays.map((holiday) => (
            <li key={holiday.date}>
              <span className="date">{holiday.date.replace(/-/g, '/')}</span>
              <span className="weekday">{weekdayLabel(holiday.date).slice(1)}</span>
              <span className="tag calm">{holiday.label}</span>
              <button
                type="button"
                className="btn btn-ghost tiny-text"
                style={{ marginLeft: 'auto' }}
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

      <p className="group-title">家庭口令</p>
      <section className="card">
        <p className="muted small">改的是你自己的口令（当前是 {config.who ?? '未知'}），改完下次登录生效。</p>
        <input
          className="input"
          type="password"
          placeholder="新的口令，至少 4 位"
          value={passcode}
          onChange={(event) => setPasscode(event.target.value)}
        />
        <button
          type="button"
          className="btn btn-soft btn-block"
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

      <p className="group-title">数据</p>
      <section className="card">
        <p className="muted small">
          把之前导出的 JSON 备份导回来。按日期合并：同一天以备份里的为准，不会删掉别的东西。学期日期和口令不在备份里，需要自己重新设。
        </p>
        <label className="btn btn-soft btn-block">
          <Icon name="download" size={18} />
          {importing ? '导入中…' : '选择备份文件导入'}
          <input
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void importBackup(file);
              event.target.value = '';
            }}
          />
        </label>
      </section>

      <section className="card">
        <button type="button" className="btn btn-danger btn-block" onClick={() => void onLogout()}>
          <Icon name="logout" size={18} />
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
  term: Term;
  onSave: (patch: { name?: string; startDate?: string; endDate?: string; isActive?: boolean }) => Promise<void>;
}) {
  const [start, setStart] = useState(term.startDate);
  const [end, setEnd] = useState(term.endDate);
  const dirty = start !== term.startDate || end !== term.endDate;

  return (
    <div className="term">
      <div className="term-head">
        <strong>{term.name}</strong>
        {term.isActive ? (
          <span className="badge-current">当前学期</span>
        ) : (
          <button type="button" className="btn btn-ghost tiny-text" onClick={() => void onSave({ isActive: true })}>
            设为当前
          </button>
        )}
      </div>
      <div className="row">
        <label className="field">
          <span className="muted tiny-text">开学日</span>
          <input className="input" type="date" value={start} onChange={(event) => setStart(event.target.value)} />
        </label>
        <label className="field">
          <span className="muted tiny-text">结束日</span>
          <input className="input" type="date" value={end} onChange={(event) => setEnd(event.target.value)} />
        </label>
      </div>
      {dirty ? (
        <button
          type="button"
          className="btn btn-primary btn-block"
          onClick={() => void onSave({ startDate: start, endDate: end })}
        >
          保存学期日期
        </button>
      ) : null}
    </div>
  );
}
