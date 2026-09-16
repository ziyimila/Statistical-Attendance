import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cookie from '@fastify/cookie';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyError, type FastifyInstance } from 'fastify';
import { verifySession } from './auth.js';
import type { AppConfig } from './config.js';
import type { Repo } from './repo/types.js';
import { SESSION_COOKIE, registerAuthRoutes } from './routes/auth.js';
import { registerRecordRoutes } from './routes/records.js';
import type { RouteDeps } from './routes/deps.js';
import { registerSettingsRoutes } from './routes/settings.js';
import { registerStatsRoutes } from './routes/stats.js';

export interface BuildAppOptions {
  repo: Repo;
  config: AppConfig;
  now?: () => Date;
  serveStatic?: boolean;
  logger?: boolean;
}

const PUBLIC_PATHS = new Set(['/api/login', '/api/health']);

export async function buildApp(options: BuildAppOptions): Promise<FastifyInstance> {
  const deps: RouteDeps = {
    repo: options.repo,
    config: options.config,
    now: options.now ?? (() => new Date()),
  };

  const app = Fastify({ logger: options.logger ?? true, bodyLimit: 128 * 1024 });
  await app.register(cookie);

  // 除登录和健康检查外，所有 /api 请求都要先过鉴权
  app.addHook('onRequest', async (request, reply) => {
    const pathname = request.url.split('?')[0];
    if (!pathname.startsWith('/api/')) return;
    if (PUBLIC_PATHS.has(pathname)) return;

    const session = verifySession(request.cookies[SESSION_COOKIE], options.config.appSecret, deps.now().getTime());
    request.who = session?.who;
    if (!session) {
      await reply.code(401).send({ error: { code: 'unauthorized', message: '请先登录' } });
    }
  });

  app.get('/api/health', async () => ({
    ok: true,
    db: await options.repo.ping(),
    time: deps.now().toISOString(),
  }));

  registerAuthRoutes(app, deps);
  registerRecordRoutes(app, deps);
  registerSettingsRoutes(app, deps);
  registerStatsRoutes(app, deps);

  if (options.serveStatic !== false) {
    const webDist = path.resolve(fileURLToPath(new URL('../../web/dist', import.meta.url)));
    if (existsSync(webDist)) {
      await app.register(fastifyStatic, { root: webDist, index: ['index.html'] });
    } else {
      app.log.warn(`前端构建产物不存在（${webDist}），本地开发请用 npm run dev:web`);
    }
  }

  app.setErrorHandler((error: FastifyError, _request, reply) => {
    if (error.validation || error.statusCode === 400) {
      return reply.code(400).send({ error: { code: 'bad_request', message: error.message } });
    }
    app.log.error(error);
    return reply.code(500).send({ error: { code: 'internal_error', message: '服务器出错了' } });
  });

  return app;
}
