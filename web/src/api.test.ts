import { afterEach, describe, expect, it, vi } from 'vitest';
import { UnauthorizedError, api } from './api';

function mockFetch(status: number, body: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(JSON.stringify(body), {
          status,
          headers: { 'Content-Type': 'application/json' },
        }),
    ),
  );
}

afterEach(() => vi.unstubAllGlobals());

describe('接口错误提示', () => {
  it('口令输错时显示服务端的话术，而不是"请先登录"', async () => {
    mockFetch(401, { error: { code: 'bad_passcode', message: '口令不对' } });
    await expect(api.login('随便输的')).rejects.toThrow('口令不对');
  });

  it('会话过期仍然是 UnauthorizedError，页面据此退回登录页', async () => {
    mockFetch(401, { error: { code: 'unauthorized', message: '请先登录' } });
    await expect(api.getConfig()).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('别的错误直接显示服务端的说明', async () => {
    mockFetch(400, { error: { code: 'bad_request', message: '日期不合法' } });
    await expect(api.deleteRecord('2026-09-31')).rejects.toThrow('日期不合法');
  });

  it('没有请求体的请求不带 Content-Type，否则后端会拒掉 DELETE', async () => {
    const calls: RequestInit[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        calls.push(init);
        return new Response('{"deleted":true}', { status: 200, headers: { 'Content-Type': 'application/json' } });
      }),
    );

    await api.deleteRecord('2026-09-16');
    expect(calls[0].headers).toEqual({});

    await api.getConfig();
    expect(calls[1].headers).toEqual({});
  });
});
