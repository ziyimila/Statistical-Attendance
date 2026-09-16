import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { MemoryRepo } from './repo/memory.js';
import { MysqlRepo } from './repo/mysql.js';
import { seedDefaults } from './repo/seed.js';
import type { Repo } from './repo/types.js';

const config = loadConfig();
const repo: Repo = config.driver === 'memory' ? new MemoryRepo() : new MysqlRepo(config.mysql);

await initWithRetry(repo);

const app = await buildApp({ repo, config });

try {
  await app.listen({ port: config.port, host: '0.0.0.0' });
  app.log.info(`已启动，数据源：${config.driver}`);
} catch (error) {
  app.log.error(error);
  process.exit(1);
}

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    void app
      .close()
      .then(() => repo.close())
      .finally(() => process.exit(0));
  });
}

/** 容器编排下 MySQL 可能比应用晚就绪，启动时重试几次 */
async function initWithRetry(target: Repo, attempts = 10, delayMs = 3000): Promise<void> {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await target.init();
      await seedDefaults(target);
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (attempt === attempts) {
        console.error(`连不上数据库，已重试 ${attempts} 次：${message}`);
        process.exit(1);
      }
      console.warn(`第 ${attempt} 次连接数据库失败，${delayMs / 1000} 秒后重试：${message}`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}
