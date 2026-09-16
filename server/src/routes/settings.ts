import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { isValidDateString } from '../domain/dates.js';
import { badRequest, notFound } from './deps.js';
import type { RouteDeps } from './deps.js';

const termBodySchema = z.object({
  name: z.string().min(1).max(64),
  startDate: z.string(),
  endDate: z.string(),
  isActive: z.boolean().optional(),
});

export function registerSettingsRoutes(app: FastifyInstance, deps: RouteDeps): void {
  app.get('/api/terms', async () => ({ terms: await deps.repo.listTerms() }));

  app.post('/api/terms', async (request, reply) => {
    const body = termBodySchema.safeParse(request.body);
    if (!body.success) return badRequest(reply, '学期信息不完整');
    const { startDate, endDate } = body.data;
    if (!isValidDateString(startDate) || !isValidDateString(endDate) || startDate > endDate) {
      return badRequest(reply, '学期起止日期不合法');
    }
    const term = await deps.repo.createTerm({ ...body.data, isActive: body.data.isActive ?? false });
    return { term };
  });

  app.put('/api/terms/:id', async (request, reply) => {
    const id = Number((request.params as { id: string }).id);
    if (!Number.isInteger(id)) return badRequest(reply, '学期不存在');

    const body = termBodySchema.partial().safeParse(request.body);
    if (!body.success) return badRequest(reply, '学期信息不合法');
    if (body.data.startDate && !isValidDateString(body.data.startDate)) return badRequest(reply, '开学日不合法');
    if (body.data.endDate && !isValidDateString(body.data.endDate)) return badRequest(reply, '结束日不合法');

    const existing = (await deps.repo.listTerms()).find((term) => term.id === id);
    if (!existing) return notFound(reply, '学期不存在');

    const start = body.data.startDate ?? existing.startDate;
    const end = body.data.endDate ?? existing.endDate;
    if (start > end) return badRequest(reply, '开学日不能晚于结束日');

    const term = await deps.repo.updateTerm(id, body.data);
    return { term };
  });

  app.get('/api/holidays', async () => ({ holidays: await deps.repo.listHolidays() }));

  app.post('/api/holidays', async (request, reply) => {
    const body = z
      .object({ date: z.string(), label: z.string().max(64).optional() })
      .safeParse(request.body);
    if (!body.success) return badRequest(reply, '请填写日期');
    if (!isValidDateString(body.data.date)) return badRequest(reply, '日期不合法');
    return { holiday: await deps.repo.addHoliday(body.data.date, body.data.label ?? '放假') };
  });

  app.delete('/api/holidays/:date', async (request, reply) => {
    const { date } = request.params as { date: string };
    if (!isValidDateString(date)) return badRequest(reply, '日期不合法');
    return { deleted: await deps.repo.deleteHoliday(date) };
  });
}
