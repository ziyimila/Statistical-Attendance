# 幼儿园上学打卡统计 —— 实现计划

依据：docs/superpowers/specs/2026-09-16-kindergarten-attendance-design.md

## 任务清单

- [x] 1. 仓库骨架：workspaces、`.gitignore`、`.dockerignore`、`.env.example`、开发脚本
- [x] 2. 后端领域层：日期工具、统计口径纯函数（`domain/stats.ts`）
- [x] 3. 统计口径单测（含节假日、跨月、学期边界、周末标请假、今天未记录）
- [x] 4. 数据访问层：Repo 接口 + MySQL 实现 + 内存实现（本地/测试用）
- [x] 5. 建表语句（幂等，`db/schema.ts`）
- [x] 6. 鉴权：口令校验、HMAC 签名 Cookie、登录限流
- [x] 7. API 路由：records / terms / holidays / stats / export / config
- [x] 8. API 测试（注入内存 Repo，走完整请求链路）
- [x] 9. 前端骨架：Vite + React + 底部标签 + 登录页
- [x] 10. 主屏打卡（含"请几天"批量）
- [x] 11. 日历视图
- [x] 12. 统计视图 + 导出
- [x] 13. 设置视图（学期、节假日、口令）
- [x] 14. 图标与 manifest（可加到手机主屏）
- [x] 15. 容器化：Dockerfile、docker-compose、healthcheck
- [x] 16. 部署文档：建库 SQL、NPM 配置、上线步骤
- [x] 17. 本地验证：构建、单测、以内存库跑通打卡流程

## 实现过程中相对设计文档做的三处调整

1. **建表语句从 `schema.sql` 改成 `db/schema.ts` 里的常量**：容器里不需要额外复制资源文件，也不会因为工作目录变化找不到文件。
2. **`schoolDays` 只统计截至今天的应上学日**，另给一个 `schoolDaysRemaining`。否则"出勤 + 请假"永远小于"应上学天数"，数字对不上账。同时补了一条恒等式的断言测试。
3. **多加了一个内存数据源（`DB_DRIVER=memory`）**：本机没有 Docker，用它在本地跑通全部流程；测试也用它，省掉测试数据库。

## 验证方式

- `npm test`：统计口径单测 + API 测试全绿
- `npm run build`：前端与后端均可产出构建产物
- `DB_DRIVER=memory npm run dev -w server`：不依赖数据库也能本地跑通全部界面
