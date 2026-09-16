import { useState } from 'react';
import type { RecordPayload } from '../api';
import { fullDate, nextSchoolDays, shortDate } from '../dates';
import {
  LEAVE_REASONS,
  LEAVE_REASON_LABELS,
  type AppConfig,
  type AttendanceRecord,
  type LeaveReason,
} from '../types';
import Icon from './Icon';

interface Props {
  date: string;
  record: AttendanceRecord | null;
  config: AppConfig;
  busy: boolean;
  onClose: () => void;
  onSave: (dates: string[], payload: RecordPayload, message: string) => Promise<void>;
  onDelete: (date: string) => Promise<void>;
}

export default function RecordSheet({ date, record, config, busy, onClose, onSave, onDelete }: Props) {
  const [status, setStatus] = useState<'present' | 'leave'>(record?.status ?? 'leave');
  const [reason, setReason] = useState<LeaveReason>(record?.reason ?? 'sick');
  const [note, setNote] = useState(record?.note ?? '');
  const [days, setDays] = useState(1);

  const holidaySet = new Set(config.holidays.map((holiday) => holiday.date));
  const dates = nextSchoolDays(date, days, holidaySet);

  const submit = async () => {
    if (status === 'present') {
      await onSave([date], { status: 'present' }, `已记录 ${shortDate(date)} 去上学`);
      return;
    }
    const payload: RecordPayload = { status: 'leave', reason, note: note.trim() || null };
    const message = dates.length > 1 ? `已请 ${dates.length} 天假` : `已记录 ${shortDate(date)} 请假`;
    await onSave(dates, payload, message);
  };

  return (
    <div className="sheet-backdrop" onClick={onClose} role="presentation">
      <div className="sheet" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
        <span className="sheet-grip" />

        <header className="sheet-head">
          <div>
            <h2>{fullDate(date)}</h2>
            {record?.byName ? <p className="muted tiny-text">{record.byName}记的</p> : null}
          </div>
          <button type="button" className="icon-btn" aria-label="关闭" onClick={onClose}>
            <Icon name="close" size={18} />
          </button>
        </header>

        <div className="segmented">
          <button
            type="button"
            className={status === 'present' ? 'seg on' : 'seg'}
            onClick={() => setStatus('present')}
          >
            去上学了
          </button>
          <button type="button" className={status === 'leave' ? 'seg on' : 'seg'} onClick={() => setStatus('leave')}>
            请假
          </button>
        </div>

        {status === 'leave' ? (
          <>
            <div className="chips">
              {LEAVE_REASONS.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={reason === item ? 'chip on' : 'chip'}
                  onClick={() => setReason(item)}
                >
                  {LEAVE_REASON_LABELS[item]}
                </button>
              ))}
            </div>

            <input
              className="input"
              placeholder="备注，比如：咳嗽发烧"
              value={note}
              maxLength={200}
              onChange={(event) => setNote(event.target.value)}
            />

            <div className="stepper">
              <span className="small muted">请几天</span>
              <div className="stepper-control">
                <button
                  type="button"
                  className="round-btn"
                  aria-label="少一天"
                  onClick={() => setDays((value) => Math.max(1, value - 1))}
                  disabled={days <= 1}
                >
                  <Icon name="minus" size={17} />
                </button>
                <strong>{days} 天</strong>
                <button
                  type="button"
                  className="round-btn"
                  aria-label="多一天"
                  onClick={() => setDays((value) => Math.min(7, value + 1))}
                  disabled={days >= 7}
                >
                  <Icon name="plus" size={17} />
                </button>
              </div>
            </div>
            {dates.length > 1 ? (
              <p className="muted tiny-text">
                将标记：{dates.map((item) => shortDate(item)).join('、')}（跳过周末和节假日）
              </p>
            ) : null}
          </>
        ) : null}

        <div className="sheet-actions">
          <button type="button" className="btn btn-primary btn-block" disabled={busy} onClick={() => void submit()}>
            {busy ? '保存中…' : '保存'}
          </button>
          {record ? (
            <button
              type="button"
              className="btn btn-danger btn-block"
              disabled={busy}
              onClick={() => void onDelete(date)}
            >
              <Icon name="trash" size={18} />
              删除这条记录
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
