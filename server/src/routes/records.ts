import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { addDays, eachDate, isValidDateString } from '../domain/dates.js';
import { LEAVE_REASONS, type LeaveReason } from '../domain/types.js';
import { badRequest } from './deps.js';
import type { RouteDeps } from './deps.js';

const reasonSchema = z.enum(LEAVE_REASONS as [LeaveReason, ...LeaveReason[]]);

const recordBodySchema = z.object({
  status: z.enum(['present', 'leave']),
  reason: reasonSchema.nullish(),
  note: z.string().max(200).nullish(),
});

const bulkBodySchema = z.object({
  dates: z.array(z.string()).min(1).max(60),
  status: z.enum(['present', 'leave']),
  reason: reasonSchema.nullish(),
  note: z.string().max(200).nullish(),
});

export function registerRecordRoutes(app: FastifyInstance, deps: RouteDeps): void {
  app.get('/api/records', async (request, reply) => {
    const query = z
      .object({ from: z.string(), to: z.string() })
      .safeParse(request.query);
    if (!query.success) return badRequest(reply, '缺少时间范围');
    const { from, to } = query.data;
    if (!isValidDateString(from) || !isValidDateString(to) || from > to) return badRequest(reply, '时间范围不合法');
    if (eachDate(from, to).length > 366) return badRequest(reply, '时间范围太大');

    return { records: await deps.repo.listRecords(from, to) };
  });

  app.put('/api/records/:date', async (request, reply) => {
    const { date } = request.params as { date: string };
    if (!isValidDateString(date)) return badRequest(reply, '日期不合法');

    const body = recordBodySchema.safeParse(request.body);
    if (!body.success) return badRequest(reply, '打卡内容不合法');

    const record = await deps.repo.upsertRecord(
      { date, status: body.data.status, reason: body.data.reason ?? null, note: body.data.note ?? null },
      request.who ?? '未知',
    );
    return { record };
  });

  /** 一次请好几天：只写数据，不引入"请假区间"这种结构 */
  app.post('/api/records/bulk', async (request, reply) => {
    const body = bulkBodySchema.safeParse(request.body);
    if (!body.success) return badRequest(reply, '批量打卡内容不合法');
    if (!body.data.dates.every(isValidDateString)) return badRequest(reply, '日期不合法');

    const records = [];
    for (const date of [...new Set(body.data.dates)].sort()) {
      records.push(
        await deps.repo.upsertRecord(
          { date, status: body.data.status, reason: body.data.reason ?? null, note: body.data.note ?? null },
          request.who ?? '未知',
        ),
      );
    }
    return { records };
  });

  app.delete('/api/records/:date', async (request, reply) => {
    const { date } = request.params as { date: string };
    if (!isValidDateString(date)) return badRequest(reply, '日期不合法');
    return { deleted: await deps.repo.deleteRecord(date) };
  });

  /** 一次拿齐首屏需要的东西，省掉好几个来回 */
  app.get('/api/config', async (request) => {
    const today = deps.now();
    const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(
      today.getDate(),
    ).padStart(2, '0')}`;
    return {
      today: todayString,
      tomorrow: addDays(todayString, 1),
      who: request.who ?? null,
      activeTerm: await deps.repo.getActiveTerm(),
      terms: await deps.repo.listTerms(),
      holidays: await deps.repo.listHolidays(),
    };
  });
}
