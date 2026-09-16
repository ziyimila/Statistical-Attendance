import type { FastifyReply } from 'fastify';
import type { AppConfig } from '../config.js';
import type { Repo } from '../repo/types.js';

export interface RouteDeps {
  repo: Repo;
  config: AppConfig;
  now: () => Date;
}

export function badRequest(reply: FastifyReply, message: string) {
  return reply.code(400).send({ error: { code: 'bad_request', message } });
}

export function notFound(reply: FastifyReply, message: string) {
  return reply.code(404).send({ error: { code: 'not_found', message } });
}
