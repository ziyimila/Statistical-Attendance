import { useEffect, useRef, useState } from 'react';
import { parseDate } from '../dates';
import { formatDays, formatRate, type AttendanceRecord, type StatsResult } from '../types';
import Icon from './Icon';

const WIDTH = 1080;
const HEIGHT = 1440;
const FONT = '"PingFang SC","HarmonyOS Sans SC","Microsoft YaHei",-apple-system,sans-serif';

interface Props {
  termName: string;
  startDate: string;
  endDate: string;
  stats: StatsResult;
  records: Map<string, AttendanceRecord>;
  holidays: Set<string>;
  onClose: () => void;
}

/** 生成一张 3:4 的学期报告卡，可以直接存成图片发出去 */
export default function ReportCard({ termName, startDate, endDate, stats, records, holidays, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const context = canvasRef.current?.getContext('2d');
    if (!context) return;
    draw(context, { termName, startDate, endDate, stats, records, holidays });
  }, [termName, startDate, endDate, stats, records, holidays]);

  const save = () => {
    canvasRef.current?.toBlob(async (blob) => {
      if (!blob) return;
      const file = new File([blob], '上学打卡.png', { type: 'image/png' });
      // 手机上优先走系统分享面板，可以直接存进相册
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file] });
          return;
        } catch {
          // 用户取消了分享，继续走下载
        }
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.name;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      setMessage('已保存，去相册或下载目录看看');
    }, 'image/png');
  };

  return (
    <div className="sheet-backdrop" onClick={onClose} role="presentation">
      <div className="sheet report-sheet" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
        <span className="sheet-grip" />
        <header className="sheet-head">
          <div>
            <h2>学期报告卡</h2>
            <p className="muted tiny-text">3:4 竖图，正好铺满小红书封面</p>
          </div>
          <button type="button" className="icon-btn" aria-label="关闭" onClick={onClose}>
            <Icon name="close" size={18} />
          </button>
        </header>

        <div className="report-preview">
          <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} />
        </div>

        <div className="sheet-actions">
          <button type="button" className="btn btn-primary btn-block" onClick={save}>
            <Icon name="download" size={18} />
            保存图片
          </button>
          {message ? <p className="muted tiny-text center-text">{message}</p> : null}
        </div>
      </div>
    </div>
  );
}

interface DrawInput {
  termName: string;
  startDate: string;
  endDate: string;
  stats: StatsResult;
  records: Map<string, AttendanceRecord>;
  holidays: Set<string>;
}

function draw(ctx: CanvasRenderingContext2D, input: DrawInput) {
  const { stats } = input;

  const background = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  background.addColorStop(0, '#fbf9f5');
  background.addColorStop(1, '#efeae1');
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.save();
  ctx.shadowColor = 'rgba(38,33,25,0.10)';
  ctx.shadowBlur = 48;
  ctx.shadowOffsetY = 16;
  ctx.fillStyle = '#ffffff';
  roundRect(ctx, 72, 96, WIDTH - 144, HEIGHT - 192, 56);
  ctx.fill();
  ctx.restore();

  const left = 152;

  // 应用标记
  ctx.fillStyle = '#e9f2e8';
  roundRect(ctx, left, 176, 92, 92, 28);
  ctx.fill();
  ctx.strokeStyle = '#4f8f5a';
  ctx.lineWidth = 9;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(left + 28, 224);
  ctx.lineTo(left + 42, 238);
  ctx.lineTo(left + 66, 208);
  ctx.stroke();

  ctx.fillStyle = '#262119';
  ctx.font = `600 40px ${FONT}`;
  ctx.fillText('上学打卡', left + 118, 238);

  ctx.font = `650 60px ${FONT}`;
  ctx.fillText(input.termName, left, 400);
  ctx.fillStyle = '#8d857a';
  ctx.font = `400 34px ${FONT}`;
  ctx.fillText(`${short(input.startDate)} — ${short(input.endDate)}`, left, 462);

  // 全勤率
  ctx.fillStyle = '#8d857a';
  ctx.font = `500 36px ${FONT}`;
  ctx.fillText('全勤率', left, 590);
  ctx.fillStyle = '#4f8f5a';
  ctx.font = `700 190px ${FONT}`;
  ctx.fillText(formatRate(stats.attendanceRate), left - 8, 766);

  ctx.fillStyle = '#8d857a';
  ctx.font = `400 30px ${FONT}`;
  ctx.fillText(
    stats.unrecorded > 0
      ? `按已记录的 ${formatDays(stats.recordedDays)} 天算，另有 ${stats.unrecorded} 天漏记`
      : `按已记录的 ${formatDays(stats.recordedDays)} 天算`,
    left,
    824,
  );

  ctx.strokeStyle = '#ece7de';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(left, 878);
  ctx.lineTo(WIDTH - left, 878);
  ctx.stroke();

  const columns = [
    { label: '出勤', value: `${formatDays(stats.presentDays)} 天`, color: '#4f8f5a' },
    { label: '缺勤', value: `${formatDays(stats.leaveDays)} 天`, color: '#d3992c' },
    { label: '应上学', value: `${stats.schoolDays} 天`, color: '#3d3730' },
  ];
  const columnWidth = (WIDTH - left * 2) / columns.length;
  columns.forEach((column, index) => {
    const x = left + columnWidth * index;
    ctx.fillStyle = column.color;
    ctx.font = `700 58px ${FONT}`;
    ctx.fillText(column.value, x, 966);
    ctx.fillStyle = '#8d857a';
    ctx.font = `400 30px ${FONT}`;
    ctx.fillText(column.label, x, 1012);
  });

  drawDays(ctx, input, left, 1064, WIDTH - left * 2, 126);

  ctx.fillStyle = '#a49a8c';
  ctx.font = `400 28px ${FONT}`;
  ctx.fillText('记下来的每一天，都是这学期的一部分', left, 1296);
}

/** 一天一格，把这个学期的每个上学日画出来 */
function drawDays(
  ctx: CanvasRenderingContext2D,
  input: DrawInput,
  x0: number,
  y0: number,
  width: number,
  maxHeight: number,
) {
  const today = todayString();

  const schoolDays: string[] = [];
  for (let cursor = input.startDate; cursor <= input.endDate; cursor = nextDay(cursor)) {
    const day = parseDate(cursor).getDay();
    if (day === 0 || day === 6) continue;
    if (input.holidays.has(cursor)) continue;
    schoolDays.push(cursor);
  }

  // 格子大小自适应：学期长的时候自动缩小，别画到卡片外面
  let size = 24;
  let gap = 8;
  let columns = 1;
  let rows = 1;
  for (const candidate of [24, 22, 20, 18, 16, 14]) {
    const candidateGap = Math.max(5, Math.round(candidate / 3));
    const candidateColumns = Math.max(1, Math.floor((width + candidateGap) / (candidate + candidateGap)));
    const candidateRows = Math.ceil(schoolDays.length / candidateColumns);
    if (candidateRows * (candidate + candidateGap) <= maxHeight || candidate === 14) {
      size = candidate;
      gap = candidateGap;
      columns = candidateColumns;
      rows = candidateRows;
      break;
    }
  }

  schoolDays.forEach((date, index) => {
    const x = x0 + (index % columns) * (size + gap);
    const y = y0 + Math.floor(index / columns) * (size + gap);
    const record = input.records.get(date);

    if (!record) {
      if (date >= today) return; // 还没到的日子不画
      ctx.fillStyle = '#f2efe9';
      roundRect(ctx, x, y, size, size, 7);
      ctx.fill();
      return;
    }

    if (record.portion === 'full') {
      ctx.fillStyle = '#a9cfa7';
      roundRect(ctx, x, y, size, size, 7);
      ctx.fill();
      return;
    }

    if (record.portion === 'absent') {
      ctx.fillStyle = '#f0c877';
      roundRect(ctx, x, y, size, size, 7);
      ctx.fill();
      return;
    }

    // 只去了半天：上半格是上午，下半格是下午
    ctx.save();
    roundRect(ctx, x, y, size, size, 7);
    ctx.clip();
    const attendedTop = record.portion === 'morning';
    ctx.fillStyle = attendedTop ? '#a9cfa7' : '#f0c877';
    ctx.fillRect(x, y, size, size / 2);
    ctx.fillStyle = attendedTop ? '#f0c877' : '#a9cfa7';
    ctx.fillRect(x, y + size / 2, size, size / 2);
    ctx.restore();
  });

  const legendY = y0 + rows * (size + gap) + 30;
  const legend = [
    { color: '#a9cfa7', label: '在园' },
    { color: '#f0c877', label: '缺勤' },
    { color: '#f2efe9', label: '漏记' },
  ];
  let legendX = x0;
  ctx.font = `400 26px ${FONT}`;
  for (const item of legend) {
    ctx.fillStyle = item.color;
    roundRect(ctx, legendX, legendY, 22, 22, 6);
    ctx.fill();
    ctx.fillStyle = '#8d857a';
    ctx.fillText(item.label, legendX + 32, legendY + 20);
    legendX += 32 + ctx.measureText(item.label).width + 44;
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, w, h, r);
    return;
  }
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function nextDay(value: string): string {
  const date = parseDate(value);
  date.setDate(date.getDate() + 1);
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${m}-${d}`;
}

function short(value: string): string {
  const [y, m, d] = value.split('-').map(Number);
  return `${y}.${m}.${d}`;
}

function todayString(): string {
  const now = new Date();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${m}-${d}`;
}
