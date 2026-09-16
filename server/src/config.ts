import { randomBytes } from 'node:crypto';

export interface AppConfig {
  port: number;
  driver: 'mysql' | 'memory';
  mysql: {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
  };
  appSecret: string;
  initialPasscodes: { mom: string; dad: string };
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const driver = env.DB_DRIVER === 'memory' ? 'memory' : 'mysql';
  const warnings: string[] = [];

  let appSecret = env.APP_SECRET ?? '';
  if (appSecret.length < 16) {
    appSecret = randomBytes(32).toString('hex');
    warnings.push('未设置 APP_SECRET（或太短），已临时生成，重启后所有人需要重新登录');
  }

  const passcode = (value: string | undefined, who: string) => {
    if (value) return value;
    const generated = randomBytes(4).toString('hex');
    warnings.push(`未设置 ${who} 的口令，本次临时口令为 ${generated}（重启会变，请在 .env 里固定）`);
    return generated;
  };

  if (warnings.length > 0) {
    for (const warning of warnings) console.warn(`[配置] ${warning}`);
  }

  return {
    port: Number(env.PORT ?? 3000),
    driver,
    mysql: {
      host: env.DB_HOST ?? '127.0.0.1',
      port: Number(env.DB_PORT ?? 3306),
      user: env.DB_USER ?? 'root',
      password: env.DB_PASSWORD ?? '',
      database: env.DB_NAME ?? 'attendance',
    },
    appSecret,
    initialPasscodes: {
      mom: passcode(env.CODE_MOM, 'CODE_MOM'),
      dad: passcode(env.CODE_DAD, 'CODE_DAD'),
    },
  };
}
