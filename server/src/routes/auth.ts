import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  PASSCODE_KEYS,
  createLoginLimiter,
  findWhoByPasscode,
  hashPasscode,
  signSession,
} from '../auth.js';
import { badRequest } from './deps.js';
import type { RouteDeps } from './deps.js';

export const SESSION_COOKIE = 'att_session';
const SESSION_DAYS = 90;

export function registerAuthRoutes(app: FastifyInstance, deps: RouteDeps): void {
  const limiter = createLoginLimiter();

  app.post('/api/login', async (request, reply) => {
    const parsed = z.object({ code: z.string().min(1).max(128) }).safeParse(request.body);
    if (!parsed.success) return badRequest(reply, '请输入口令');

    const nowMs = deps.now().getTime();
    if (!limiter.allow(request.ip, nowMs)) {
      return reply.code(429).send({ error: { code: 'too_many_requests', message: '尝试太频繁了，等一分钟再试' } });
    }

    const who = await findWhoByPasscode(deps.repo, parsed.data.code, deps.config.initialPasscodes);
    if (!who) {
      return reply.code(401).send({ error: { code: 'bad_passcode', message: '口令不对' } });
    }

    const exp = nowMs + SESSION_DAYS * 24 * 60 * 60 * 1000;
    reply.setCookie(SESSION_COOKIE, signSession({ who, exp }, deps.config.appSecret), {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      // 生产环境走 NPM 的 HTTPS，本地开发走 http，不禁用本地调试
      secure: process.env.NODE_ENV === 'production',
      maxAge: SESSION_DAYS * 24 * 60 * 60,
    });
    return { who };
  });

  app.post('/api/logout', async (_request, reply) => {
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return { ok: true };
  });

  /** 设置页改口令：默认改自己的那个 */
  app.put('/api/passcode', async (request, reply) => {
    const parsed = z
      .object({ who: z.enum(['妈妈', '爸爸']).optional(), code: z.string().min(4).max(128) })
      .safeParse(request.body);
    if (!parsed.success) return badRequest(reply, '新口令至少 4 位');

    const who = parsed.data.who ?? request.who;
    if (who !== '妈妈' && who !== '爸爸') return badRequest(reply, '只能改妈妈或爸爸的口令');

    await deps.repo.setSetting(who === '妈妈' ? PASSCODE_KEYS.mom : PASSCODE_KEYS.dad, hashPasscode(parsed.data.code));
    return { ok: true, who };
  });
}
