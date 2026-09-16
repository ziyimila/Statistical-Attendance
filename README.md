# 幼儿园上学打卡

给自家孩子记出勤的小应用：每天点一下，自动统计这个月、这个学期上了多少天、请了多少天假。手机和电脑打开同一个链接、共用同一份数据，加到手机主屏就是个小 App。

## 它做什么

- **打卡**：主屏点「今天去了」一下搞定。有情况就点「今天请假」进面板选：全天在园 / 只去了上午 / 只去了下午 / 全天没去。
- **半天**：幼儿园常规是 8:30–15:30 全天，早上没送下午才去、或者中午接走，都记成"只去了半天"，统计时算 0.5 天出勤 + 0.5 天缺勤，两个信息都不丢。
- **连着请几天**：面板里选"请几天"，后面几天自动标上，遇到周末和节假日自动跳过；后来不用请了，主屏提示条上点「撤销」一次退掉。
- **园里放假**：法定假期、流感停课、园庆活动都记成"这天园里放假"，它让那天不算应上学日，但**不算你娃缺勤**——这个数字才不会被撑虚。
- **日历**：绿色全天在园、上下两段色是只去了半天、黄色全天没去、灰色周末和放假、虚线是没记录的日子。点任意一天都能补录或修改。
- **统计**：本月和本学期的出勤、缺勤、未记录天数（可以是 5.5 这种半天），缺勤按病假/事假分类小计，另报"其中只去半天 N 次"，加一份逐条明细。
- **容错**：忘了打卡的日子单独算"未记录"并提醒补录；点错了在提示条上点「撤销」就能还原成改动前的样子。
- **导出与备份**：CSV 可按月导出（Excel 直接打开），JSON 备份可以在设置页导回来恢复。

## 技术构成

| 层 | 选型 |
|---|---|
| 前端 | Vite + React + TypeScript（构建产物是静态文件，由后端一起发） |
| 后端 | Node.js + Fastify + mysql2 |
| 数据库 | MySQL 8（复用服务器上已有的容器，只新建一个库） |
| 部署 | Docker + docker compose，Nginx Proxy Manager 负责域名和 HTTPS |

前端静态资源和 API 由同一个 Node 进程提供，所以线上只有一个自建容器。

## 本地开发

```bash
npm install
cp .env.example .env     # Windows: Copy-Item .env.example .env
```

把 `.env` 里 `DB_DRIVER` 改成 `memory`，再填上 `APP_SECRET`、`CODE_MOM`、`CODE_DAD`，就能不装数据库直接跑：

```bash
npm run dev
```

后端在 http://localhost:3000，前端在 http://localhost:5173，`Ctrl+C` 一起停。
两个想分开跑也行（`npm run dev:server` / `npm run dev:web`），但**前端的接口请求是代理到 3000 的**，所以 `.env` 里的 `PORT` 要保持 3000，不然页面能打开但登录会失败。
只看界面、不需要热更新的话，`npm run dev:server` 之后直接开 http://localhost:3000 就够了——后端会把构建好的前端一起发出来。

内存模式重启后数据就没了，只用来看界面和试流程。要连真实数据库，把 `DB_DRIVER` 改回 `mysql` 并填上连接信息。

## 测试与构建

```bash
npm test        # 统计口径的单测 + 接口测试
npm run build   # 构建前端和后端
npm run icons   # 重新生成手机主屏图标（改配色时用）
```

统计口径是这个应用里唯一"算错了也不会报错"的地方，全部收在 `server/src/domain/stats.ts` 的纯函数里，改口径先改测试。

## 部署到服务器

假设服务器上已经有 MySQL 容器和 Nginx Proxy Manager，两者都在 `app_net` 网络里。

### 1. 建库和账号

在服务器上以 MySQL root 身份执行 `deploy/init-db.sql`（记得先把里面的密码改掉）：

```bash
docker exec -i mysql mysql -uroot -p < deploy/init-db.sql
```

### 2. 准备配置

```bash
cp .env.example .env
```

填这几项：`DB_PASSWORD`、`APP_SECRET`（一串随机字符）、`CODE_MOM`、`CODE_DAD`。`DB_HOST` 保持 `mysql`，`DB_NAME` 保持 `attendance`。

### 3. 起容器

```bash
docker compose up -d --build
docker compose logs -f attendance
```

首次启动会自动建表，并预填一份 2026 秋季学期（开学日 9 月 7 日）和国定节假日——**请到设置页按幼儿园的实际通知核对**。

容器只在 `app_net` 内网监听 3000，不会占用宿主机端口。

### 4. Nginx Proxy Manager

新增一个 Proxy Host：

- Domain：你的子域名，例如 `attendance.example.com`
- Scheme：`http`
- Forward Hostname：`attendance`
- Forward Port：`3000`
- 打开 SSL，申请 Let's Encrypt 证书，勾上 Force SSL

### 5. 手机加到主屏

用手机浏览器打开域名 → 输入家庭口令 → 分享菜单里选"添加到主屏幕"。之后从桌面图标进入，全屏无地址栏，和 App 一样。

## 目录结构

```
server/src/
  domain/          日期工具、统计口径（纯函数，重点测试对象）
  repo/            数据访问：MySQL 实现 + 内存实现
  routes/          API 路由
  db/schema.ts     建表语句（幂等，启动时执行）
  auth.ts          口令校验、签名 Cookie
web/src/
  views/           打卡 / 日历 / 统计 / 设置
  components/      请假面板
scripts/           图标生成
deploy/            建库 SQL
docs/superpowers/  设计文档与实现计划
```

## 统计口径

- **应上学日** = 学期起止区间内，周一到周五，且不在"放假安排"里的日子。
- **出勤 / 缺勤**：应上学日里已打卡的部分。全天在园记 1 天，全天没去记 1 天，只去了半天记 0.5 天出勤 + 0.5 天缺勤。
- **未记录**：应上学日里，今天之前还没打卡的天数，单独列出来提醒补录。
- **今天**：还没打卡时算"待打卡"，不算未记录。
- **提前请假**：未来的请假只做提示，不计入缺勤天数，等到那天自然生效。
- **园里放假**：不进应上学日，也不算缺勤，单独报一个天数。
- 恒等式：`出勤 + 缺勤 + 未记录 + （今天待打卡 ? 1 : 0）= 应上学天数（截至今天）`，测试会盯着这一条。
