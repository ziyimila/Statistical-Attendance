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

const auth = () => ({ cookie });

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
    expect(response.json().error.message).toBe('口令不对');
    expect(response.cookies).toHaveLength(0);
  });

  it('打卡、批量请假、查询、删除走通一遍', async () => {
    const put = await app.inject({
      method: 'PUT',
      url: '/api/records/2026-09-14',
      headers: auth(),
      payload: { portion: 'absent', reason: 'sick', note: '咳嗽' },
    });
    expect(put.statusCode).toBe(200);
    expect(put.json().record).toMatchObject({ date: '2026-09-14', portion: 'absent', byName: '妈妈' });

    const bulk = await app.inject({
      method: 'POST',
      url: '/api/records/bulk',
      headers: auth(),
      payload: { dates: ['2026-09-17', '2026-09-18'], portion: 'absent', reason: 'sick' },
    });
    expect(bulk.statusCode).toBe(200);
    expect(bulk.json().records).toHaveLength(2);

    const list = await app.inject({
      method: 'GET',
      url: '/api/records?from=2026-09-01&to=2026-09-30',
      headers: auth(),
    });
    expect(list.json().records).toHaveLength(3);

    const removed = await app.inject({
      method: 'DELETE',
      url: '/api/records/2026-09-14',
      headers: auth(),
    });
    expect(removed.json().deleted).toBe(true);
  });

  it('可以只记半天', async () => {
    const response = await app.inject({
      method: 'PUT',
      url: '/api/records/2026-09-15',
      headers: auth(),
      payload: { portion: 'morning', reason: 'sick', note: '中午接走' },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().record.portion).toBe('morning');

    const stats = (
      await app.inject({ method: 'GET', url: '/api/stats?scope=month&month=2026-09', headers: auth() })
    ).json().stats;
    expect(stats.presentDays).toBe(0.5);
    expect(stats.leaveDays).toBe(0.5);
    expect(stats.halfDayLeaveCount).toBe(1);
    expect(stats.leaveDetails[0]).toMatchObject({ portionLabel: '只去了上午', absentDays: 0.5 });
  });

  it('提前请的三天可以一次撤销掉', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/records/bulk',
      headers: auth(),
      payload: { dates: ['2026-09-17', '2026-09-18', '2026-09-21'], portion: 'absent', reason: 'sick' },
    });
    let stats = (
      await app.inject({ method: 'GET', url: '/api/stats?scope=month&month=2026-09', headers: auth() })
    ).json().stats;
    expect(stats.upcomingLeaveDates).toEqual(['2026-09-17', '2026-09-18', '2026-09-21']);

    const undone = await app.inject({
      method: 'POST',
      url: '/api/records/bulk-delete',
      headers: auth(),
      payload: { dates: ['2026-09-17', '2026-09-18', '2026-09-21'] },
    });
    expect(undone.json().deleted).toBe(3);

    stats = (await app.inject({ method: 'GET', url: '/api/stats?scope=month&month=2026-09', headers: auth() })).json()
      .stats;
    expect(stats.upcomingLeaveDates).toEqual([]);
  });

  it('园里放假那天不算应上学日', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/holidays',
      headers: auth(),
      payload: { date: '2026-09-16', label: '园里停课' },
    });

    const stats = (
      await app.inject({ method: 'GET', url: '/api/stats?scope=month&month=2026-09', headers: auth() })
    ).json().stats;
    expect(stats.holidayDays).toBe(1);
    expect(stats.schoolDays).toBe(7);
    expect(stats.pendingToday).toBe(false);
  });

  it('拒绝非法日期和非法状态', async () => {
    const badDate = await app.inject({
      method: 'PUT',
      url: '/api/records/2026-09-31',
      headers: auth(),
      payload: { portion: 'full' },
    });
    expect(badDate.statusCode).toBe(400);

    const badPortion = await app.inject({
      method: 'PUT',
      url: '/api/records/2026-09-16',
      headers: auth(),
      payload: { portion: 'holiday' },
    });
    expect(badPortion.statusCode).toBe(400);
  });

  it('删除请求带 JSON 头但没有请求体也能删掉', async () => {
    await app.inject({
      method: 'PUT',
      url: '/api/records/2026-09-15',
      headers: auth(),
      payload: { portion: 'full' },
    });

    // 浏览器端的 fetch 默认会带这个头，早先就是它把 DELETE 判成了 400
    const response = await app.inject({
      method: 'DELETE',
      url: '/api/records/2026-09-15',
      headers: { ...auth(), 'content-type': 'application/json' },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().deleted).toBe(true);
  });

  it('首屏配置一次拿齐', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/config', headers: auth() });
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
      headers: auth(),
      payload: { code: 'new-pass', who: '妈妈' },
    });
    expect(changed.statusCode).toBe(200);

    expect((await login('mom-pass')).statusCode).toBe(401);
    expect((await login('new-pass')).statusCode).toBe(200);
  });

  it('导出的 CSV 带半天和缺勤天数两列', async () => {
    await app.inject({
      method: 'PUT',
      url: '/api/records/2026-09-15',
      headers: auth(),
      payload: { portion: 'afternoon', reason: 'sick', note: '咳嗽,发烧' },
    });

    const response = await app.inject({ method: 'GET', url: '/api/export?format=csv&month=2026-09', headers: auth() });
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/csv');
    expect(response.body).toContain('日期,星期,在园情况,缺勤天数,请假原因,备注,记录人');
    expect(response.body).toContain('只去了下午');
    expect(response.body).toContain('"咳嗽,发烧"');
  });

  it('导出的 JSON 可以导回来', async () => {
    await app.inject({
      method: 'PUT',
      url: '/api/records/2026-09-15',
      headers: auth(),
      payload: { portion: 'morning', reason: 'sick' },
    });
    const backup = (await app.inject({ method: 'GET', url: '/api/export?format=json', headers: auth() })).json();

    const restored = await app.inject({
      method: 'POST',
      url: '/api/import',
      headers: auth(),
      payload: { records: backup.records, holidays: backup.holidays },
    });
    expect(restored.statusCode).toBe(200);
    expect(restored.json().imported.records).toBe(1);

    const list = (
      await app.inject({ method: 'GET', url: '/api/records?from=2026-09-01&to=2026-09-30', headers: auth() })
    ).json().records;
    expect(list[0].portion).toBe('morning');
  });

  it('学期和节假日可以改', async () => {
    const terms = (await app.inject({ method: 'GET', url: '/api/terms', headers: auth() })).json().terms;
    const updated = await app.inject({
      method: 'PUT',
      url: `/api/terms/${terms[0].id}`,
      headers: auth(),
      payload: { endDate: '2027-01-29' },
    });
    expect(updated.json().term.endDate).toBe('2027-01-29');

    await app.inject({
      method: 'POST',
      url: '/api/holidays',
      headers: auth(),
      payload: { date: '2026-11-02', label: '园里活动' },
    });
    const holidays = (await app.inject({ method: 'GET', url: '/api/holidays', headers: auth() })).json().holidays;
    expect(holidays.some((holiday: { date: string }) => holiday.date === '2026-11-02')).toBe(true);

    const removed = await app.inject({
      method: 'DELETE',
      url: '/api/holidays/2026-11-02',
      headers: auth(),
    });
    expect(removed.json().deleted).toBe(true);
  });
});
