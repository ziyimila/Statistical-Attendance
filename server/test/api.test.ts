import { beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import type { AppConfig } from '../src/config.js';
import { MemoryRepo } from '../src/repo/memory.js';
import { seedDefaults } from '../src/repo/seed.js';

const config: AppConfig = {
  port: 0,
  driver: 'memory',
  mysql: { host: 'localhost', port: 3306, user: 'u', password: 'p', database: 'd' },
  appSecret: 'test-secret-for-vitest-only',
  initialPasscodes: { mom: 'mom-pass', dad: 'dad-pass' },
};

const today = new Date(2026, 8, 16, 8, 0, 0);

let app: FastifyInstance;
let cookie: string;

async function login(code: string) {
  return app.inject({ method: 'POST', url: '/api/login', payload: { code } });
}

beforeEach(async () => {
  const repo = new MemoryRepo();
  await repo.init();
  await seedDefaults(repo);
  app = await buildApp({ repo, config, now: () => today, serveStatic: false, logger: false });
  const response = await login('mom-pass');
  cookie = `att_session=${response.cookies.find((item) => item.name === 'att_session')?.value}`;
});

describe('接口', () => {
  it('健康检查不需要登录', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ ok: true, db: true });
  });

  it('未登录不能读写数据', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/records?from=2026-09-01&to=2026-09-30' });
    expect(response.statusCode).toBe(401);
  });

  it('口令不对时不发会话', async () => {
    const response = await login('wrong');
    expect(response.statusCode).toBe(401);
    expect(response.cookies).toHaveLength(0);
  });

  it('打卡、批量请假、查询、删除走通一遍', async () => {
    const put = await app.inject({
      method: 'PUT',
      url: '/api/records/2026-09-14',
      headers: { cookie },
      payload: { status: 'leave', reason: 'sick', note: '咳嗽' },
    });
    expect(put.statusCode).toBe(200);
    expect(put.json().record).toMatchObject({ date: '2026-09-14', status: 'leave', byName: '妈妈' });

    const bulk = await app.inject({
      method: 'POST',
      url: '/api/records/bulk',
      headers: { cookie },
      payload: { dates: ['2026-09-17', '2026-09-18'], status: 'leave', reason: 'sick' },
    });
    expect(bulk.statusCode).toBe(200);
    expect(bulk.json().records).toHaveLength(2);

    const list = await app.inject({
      method: 'GET',
      url: '/api/records?from=2026-09-01&to=2026-09-30',
      headers: { cookie },
    });
    expect(list.json().records).toHaveLength(3);

    const removed = await app.inject({
      method: 'DELETE',
      url: '/api/records/2026-09-14',
      headers: { cookie },
    });
    expect(removed.json().deleted).toBe(true);
  });

  it('打卡记录同时出现在统计里', async () => {
    await app.inject({
      method: 'PUT',
      url: '/api/records/2026-09-15',
      headers: { cookie },
      payload: { status: 'leave', reason: 'sick' },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/stats?scope=month&month=2026-09',
      headers: { cookie },
    });
    const body = response.json();
    expect(response.statusCode).toBe(200);
    expect(body.stats.leave).toBe(1);
    expect(body.stats.unrecorded).toBe(6);
    expect(body.term.name).toBe('2026 秋季学期');
  });

  it('拒绝非法日期和非法状态', async () => {
    const badDate = await app.inject({
      method: 'PUT',
      url: '/api/records/2026-09-31',
      headers: { cookie },
      payload: { status: 'present' },
    });
    expect(badDate.statusCode).toBe(400);

    const badStatus = await app.inject({
      method: 'PUT',
      url: '/api/records/2026-09-16',
      headers: { cookie },
      payload: { status: 'holiday' },
    });
    expect(badStatus.statusCode).toBe(400);
  });

  it('首屏配置一次拿齐', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/config', headers: { cookie } });
    const body = response.json();
    expect(body.today).toBe('2026-09-16');
    expect(body.who).toBe('妈妈');
    expect(body.activeTerm.startDate).toBe('2026-09-07');
    expect(body.holidays.length).toBeGreaterThan(5);
  });

  it('改口令后用新口令登录', async () => {
    const changed = await app.inject({
      method: 'PUT',
      url: '/api/passcode',
      headers: { cookie },
      payload: { code: 'new-pass', who: '妈妈' },
    });
    expect(changed.statusCode).toBe(200);

    expect((await login('mom-pass')).statusCode).toBe(401);
    expect((await login('new-pass')).statusCode).toBe(200);
  });

  it('导出 CSV 带表头且不误伤中文', async () => {
    await app.inject({
      method: 'PUT',
      url: '/api/records/2026-09-15',
      headers: { cookie },
      payload: { status: 'leave', reason: 'sick', note: '咳嗽,发烧' },
    });

    const response = await app.inject({ method: 'GET', url: '/api/export?format=csv', headers: { cookie } });
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/csv');
    expect(response.body).toContain('日期,状态,请假原因,备注,记录人');
    expect(response.body).toContain('"咳嗽,发烧"');
  });

  it('学期和节假日可以改', async () => {
    const terms = (await app.inject({ method: 'GET', url: '/api/terms', headers: { cookie } })).json().terms;
    const updated = await app.inject({
      method: 'PUT',
      url: `/api/terms/${terms[0].id}`,
      headers: { cookie },
      payload: { endDate: '2027-01-29' },
    });
    expect(updated.json().term.endDate).toBe('2027-01-29');

    await app.inject({
      method: 'POST',
      url: '/api/holidays',
      headers: { cookie },
      payload: { date: '2026-11-02', label: '园里活动' },
    });
    const holidays = (await app.inject({ method: 'GET', url: '/api/holidays', headers: { cookie } })).json().holidays;
    expect(holidays.some((holiday: { date: string }) => holiday.date === '2026-11-02')).toBe(true);

    const removed = await app.inject({
      method: 'DELETE',
      url: '/api/holidays/2026-11-02',
      headers: { cookie },
    });
    expect(removed.json().deleted).toBe(true);
  });
});
