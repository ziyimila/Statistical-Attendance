import { useState } from 'react';
import type { RecordPayload } from '../api';
import { fullDate, nextSchoolDays, shortDate } from '../dates';
import {
  LEAVE_REASONS,
  LEAVE_REASON_LABELS,
  PORTION_LABELS,
  PORTION_ORDER,
  type AppConfig,
  type AttendancePortion,
  type AttendanceRecord,
  type LeaveReason,
} from '../types';
import Icon from './Icon';

interface Props {
  date: string;
  record: AttendanceRecord | null;
  config: AppConfig;
  busy: boolean;
  isHoliday: boolean;
  onClose: () => void;
  onSave: (dates: string[], payload: RecordPayload, message: string) => Promise<void>;
  onDelete: (date: string) => Promise<void>;
  onToggleHoliday: (date: string) => Promise<void>;
}

const PORTION_HINTS: Record<AttendancePortion, string> = {
  full: '一整天都在园',
  morning: '中午接走',
  afternoon: '上午没去',
  absent: '整天请假',
};

export default function RecordSheet({
  date,
  record,
  config,
  busy,
  isHoliday,
  onClose,
  onSave,
  onDelete,
  onToggleHoliday,
}: Props) {
  const [portion, setPortion] = useState<AttendancePortion>(record?.portion ?? 'absent');
  const [reason, setReason] = useState<LeaveReason>(record?.reason ?? 'sick');
  const [note, setNote] = useState(record?.note ?? '');
  const [days, setDays] = useState(1);

  const holidaySet = new Set(config.holidays.map((holiday) => holiday.date));
  const dates = nextSchoolDays(date, days, holidaySet);
  const needsReason = portion !== 'full';

  const submit = async () => {
    const payload: RecordPayload = {
      portion,
      reason: needsReason ? reason : null,
      note: needsReason ? note.trim() || null : null,
    };
    if (portion === 'absent' && days > 1) {
      await onSave(dates, payload, `已请 ${dates.length} 天假`);
      return;
    }
    const message =
      portion === 'full'
        ? `已记录 ${shortDate(date)} 去上学`
        : `已记录 ${shortDate(date)}：${PORTION_LABELS[portion]}`;
    await onSave([date], payload, message);
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

        {isHoliday ? (
          <>
            <div className="notice calm">
              <Icon name="calendarMinus" size={19} />
              <span>这天标记为园里放假，不计入应上学日，也不占请假天数</span>
            </div>
            <button
              type="button"
              className="btn btn-soft btn-block"
              disabled={busy}
              onClick={() => void onToggleHoliday(date)}
            >
              取消放假，恢复成上学日
            </button>
          </>
        ) : (
          <>
            <div className="choices">
              {PORTION_ORDER.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={portion === item ? 'choice on' : 'choice'}
                  onClick={() => setPortion(item)}
                >
                  <strong>{PORTION_LABELS[item]}</strong>
                  <span className="muted tiny-text">{PORTION_HINTS[item]}</span>
                </button>
              ))}
            </div>

            {needsReason ? (
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
              </>
            ) : null}

            {portion === 'absent' ? (
              <>
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

            <button
              type="button"
              className="btn btn-ghost tiny-text"
              disabled={busy}
              onClick={() => void onToggleHoliday(date)}
            >
              这天园里放假（停课 / 活动）
            </button>
          </>
        )}

        <div className="sheet-actions">
          {!isHoliday ? (
            <button type="button" className="btn btn-primary btn-block" disabled={busy} onClick={() => void submit()}>
              {busy ? '保存中…' : '保存'}
            </button>
          ) : null}
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
