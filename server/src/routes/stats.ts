import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { intersectRange, isValidMonthString, monthRange, toDateString } from '../domain/dates.js';
import { computeStats } from '../domain/stats.js';
import { LEAVE_REASON_LABELS } from '../domain/types.js';
import { badRequest, notFound } from './deps.js';
import type { RouteDeps } from './deps.js';

const WIDE_RANGE = { from: '2000-01-01', to: '2099-12-31' };

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
    const query = z.object({ format: z.enum(['json', 'csv']).default('json') }).safeParse(request.query);
    if (!query.success) return badRequest(reply, '导出格式只支持 json 或 csv');

    const [records, holidays, terms] = await Promise.all([
      deps.repo.listRecords(WIDE_RANGE.from, WIDE_RANGE.to),
      deps.repo.listHolidays(),
      deps.repo.listTerms(),
    ]);
    const today = toDateString(deps.now());

    if (query.data.format === 'json') {
      reply.header('Content-Disposition', `attachment; filename="attendance-${today}.json"`);
      return { exportedAt: new Date().toISOString(), records, holidays, terms };
    }

    const header = '日期,状态,请假原因,备注,记录人';
    const lines = records.map((record) => {
      const cells = [
        record.date,
        record.status === 'present' ? '上学' : '请假',
        record.reason ? LEAVE_REASON_LABELS[record.reason] : '',
        record.note ?? '',
        record.byName ?? '',
      ];
      return cells.map(csvCell).join(',');
    });
    // BOM：让 Excel 直接双击打开不乱码
    const csv = `\uFEFF${[header, ...lines].join('\r\n')}\r\n`;
    reply.header('Content-Type', 'text/csv; charset=utf-8');
    reply.header('Content-Disposition', `attachment; filename="attendance-${today}.csv"`);
    return csv;
  });
}

function csvCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}
