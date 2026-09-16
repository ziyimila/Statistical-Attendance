import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { Repo } from './repo/types.js';

export const PASSCODE_KEYS = { mom: 'passcode.mom', dad: 'passcode.dad' } as const;

export type Who = '妈妈' | '爸爸';

export interface Session {
  who: string;
  exp: number;
}

export function hashPasscode(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/** 口令优先取数据库里的（设置页改过的），否则用环境变量里的初始值 */
export async function findWhoByPasscode(
  repo: Repo,
  code: string,
  initial: { mom: string; dad: string },
): Promise<Who | null> {
  const candidates: Array<{ who: Who; hash: string }> = [
    { who: '妈妈', hash: (await repo.getSetting(PASSCODE_KEYS.mom)) ?? hashPasscode(initial.mom) },
    { who: '爸爸', hash: (await repo.getSetting(PASSCODE_KEYS.dad)) ?? hashPasscode(initial.dad) },
  ];
  const incoming = hashPasscode(code);
  const matched = candidates.find((candidate) => safeEqual(candidate.hash, incoming));
  return matched?.who ?? null;
}

export function signSession(session: Session, secret: string): string {
  const payload = Buffer.from(JSON.stringify(session), 'utf8').toString('base64url');
  const signature = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

export function verifySession(token: string | undefined, secret: string, nowMs: number): Session | null {
  if (!token) return null;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;

  const expected = createHmac('sha256', secret).update(payload).digest('base64url');
  if (!safeEqual(signature, expected)) return null;

  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Session;
    if (!session?.who || typeof session.exp !== 'number' || session.exp <= nowMs) return null;
    return session;
  } catch {
    return null;
  }
}

/** 登录尝试限流：同一个来源每分钟最多 limit 次 */
export function createLoginLimiter(limit = 5, windowMs = 60_000) {
  const attempts = new Map<string, number[]>();
  return {
    allow(key: string, nowMs: number): boolean {
      const recent = (attempts.get(key) ?? []).filter((time) => nowMs - time < windowMs);
      if (recent.length >= limit) {
        attempts.set(key, recent);
        return false;
      }
      recent.push(nowMs);
      attempts.set(key, recent);
      return true;
    },
  };
}
