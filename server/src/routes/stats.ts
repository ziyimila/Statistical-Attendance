import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  intersectRange,
  isValidDateString,
  isValidMonthString,
  monthRange,
  toDateString,
  weekdayLabel,
} from '../domain/dates.js';
import { computeStats } from '../domain/stats.js';
import {
  ABSENT_HALVES,
  ATTENDANCE_PORTIONS,
  LEAVE_REASONS,
  LEAVE_REASON_LABELS,
  PORTION_LABELS,
  type AttendancePortion,
  type LeaveReason,
} from '../domain/types.js';
import { badRequest, notFound } from './deps.js';
import type { RouteDeps } from './deps.js';

const WIDE_RANGE = { from: '2000-01-01', to: '2099-12-31' };
const portionSchema = z.enum(ATTENDANCE_PORTIONS as [AttendancePortion, ...AttendancePortion[]]);
const reasonSchema = z.enum(LEAVE_REASONS as [LeaveReason, ...LeaveReason[]]);

export function registerStatsRoutes(app: FastifyInstance, deps: RouteDeps): void {
  app.get('/api/stats', async (request, reply) => {
    const query = z
      .object({ scope: z.enum(['month', 'term']).default('month'), month: z.string().optional() })
      .safeParse(request.query);
    if (!query.success) return badRequest(reply, '统计参数不合法');

    const { scope, month } = query.data;
    if (scope === 'month' && !isValidMonthString(month)) return badRequest(reply, '月份格式应为 2026-09');

    const today = toDateString(deps.now());
    const activeTerm = await deps.repo.getActiveTerm();
    if (!activeTerm) return notFound(reply, '还没有设置学期，请先到设置页添加');

    const termRange = { from: activeTerm.startDate, to: activeTerm.endDate };
    const range = scope === 'month' ? intersectRange(monthRange(month as string), termRange) : termRange;
    const fetchRange = range ?? { from: today, to: today };

    const [records, holidays] = await Promise.all([
      deps.repo.listRecords(fetchRange.from, fetchRange.to),
      deps.repo.listHolidays(),
    ]);

    const stats = computeStats({
      records,
      holidays: holidays.map((holiday) => holiday.date),
      term: activeTerm,
      scope,
      month: scope === 'month' ? (month as string) : undefined,
      today,
    });
    return { stats, term: activeTerm, today };
  });

  app.get('/api/export', async (request, reply) => {
    const query = z
      .object({ format: z.enum(['json', 'csv']).default('json'), month: z.string().optional() })
      .safeParse(request.query);
    if (!query.success) return badRequest(reply, '导出参数不合法');

    const { format, month } = query.data;
    if (month && !isValidMonthString(month)) return badRequest(reply, '月份格式应为 2026-09');

    const bounds = month ? monthRange(month) : WIDE_RANGE;
    const [records, holidays, terms] = await Promise.all([
      deps.repo.listRecords(bounds.from, bounds.to),
      deps.repo.listHolidays(),
      deps.repo.listTerms(),
    ]);
    const today = toDateString(deps.now());
    const suffix = month ?? today;

    if (format === 'json') {
      reply.header('Content-Disposition', `attachment; filename="attendance-${suffix}.json"`);
      return { exportedAt: new Date().toISOString(), records, holidays, terms };
    }

    const header = '日期,星期,在园情况,缺勤天数,请假原因,备注,记录人';
    const lines = records
      .slice()
      .sort((a, b) => (a.date < b.date ? -1 : 1))
      .map((record) => {
        const cells = [
          record.date,
          weekdayLabel(record.date),
          PORTION_LABELS[record.portion],
          String(ABSENT_HALVES[record.portion] / 2),
          record.reason ? LEAVE_REASON_LABELS[record.reason] : '',
          record.note ?? '',
          record.byName ?? '',
        ];
        return cells.map(csvCell).join(',');
      });
    // BOM：让 Excel 直接双击打开不乱码
    const csv = `\uFEFF${[header, ...lines].join('\r\n')}\r\n`;
    reply.header('Content-Type', 'text/csv; charset=utf-8');
    reply.header('Content-Disposition', `attachment; filename="attendance-${suffix}.csv"`);
    return csv;
  });

  /** 从导出的 JSON 恢复数据：按日期合并，只增改、不删除 */
  app.post('/api/import', async (request, reply) => {
    const body = z
      .object({
        records: z
          .array(
            z.object({
              date: z.string(),
              portion: portionSchema,
              reason: reasonSchema.nullish(),
              note: z.string().max(200).nullish(),
            }),
          )
          .max(3000)
          .optional(),
        holidays: z
          .array(z.object({ date: z.string(), label: z.string().max(64).nullish() }))
          .max(1000)
          .optional(),
      })
      .safeParse(request.body);
    if (!body.success) return badRequest(reply, '备份文件格式不对');

    let importedRecords = 0;
    for (const item of body.data.records ?? []) {
      if (!isValidDateString(item.date)) continue;
      await deps.repo.upsertRecord(
        { date: item.date, portion: item.portion, reason: item.reason ?? null, note: item.note ?? null },
        request.who ? `${request.who}（导入）` : '导入',
      );
      importedRecords += 1;
    }

    let importedHolidays = 0;
    for (const item of body.data.holidays ?? []) {
      if (!isValidDateString(item.date)) continue;
      await deps.repo.addHoliday(item.date, item.label || '放假');
      importedHolidays += 1;
    }

    return { imported: { records: importedRecords, holidays: importedHolidays } };
  });
}

function csvCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}
