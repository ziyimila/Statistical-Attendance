/**
 * 一条命令同时起后端和前端：npm run dev
 * 后端 http://localhost:3000（内存数据源，重启即清空）
 * 前端 http://localhost:5173（带热更新，接口请求代理到后端）
 */
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// 用整条命令字符串加 shell，避免 Windows 上 shell + 参数数组触发的弃用告警
const children = ['npm run dev -w server', 'npm run dev -w web'].map((command) =>
  spawn(command, { cwd: root, stdio: 'inherit', shell: true }),
);

console.log('\n后端 http://localhost:3000   ·   前端 http://localhost:5173');
console.log('两个都起来后打开前端地址即可；按 Ctrl+C 一起停掉。\n');

function shutdown(code = 0) {
  for (const child of children) child.kill();
  process.exit(code);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
for (const child of children) {
  child.on('exit', (code) => {
    if (code && code !== 0) {
      console.error(`有子进程异常退出（代码 ${code}），另一个也一起停掉`);
      shutdown(code);
    }
  });
}
