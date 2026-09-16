import 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    /** 由鉴权钩子写入：当前登录的家长 */
    who?: string;
  }
}
