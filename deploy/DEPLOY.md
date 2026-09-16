# 部署步骤

服务器上已经有 MySQL 和 Nginx Proxy Manager，都接在 `app_net` 网络上。本应用只新增**一个容器**，不占宿主机端口，不碰 `proxy_net`。

## 需要准备的东西

| 项 | 说明 |
|---|---|
| 代码上服务器 | `git push` 之后在服务器上 `git clone`，或者直接把目录传上去 |
| 数据库 | 在已有的 MySQL 里新建 `attendance` 库和专用账号 |
| `.env` | 数据库密码、`APP_SECRET`、两个家庭口令 |
| 子域名 | 例如 `attendance.你的域名.com`，解析到服务器 IP |
| NPM | 加一个 Proxy Host |

## 一、代码上服务器

本地推代码（这台机器上仓库还没推过）：

```bash
git push
```

服务器上拉下来：

```bash
cd /opt        # 放哪儿随你
git clone https://github.com/ziyimila/Statistical-Attendance.git attendance
cd attendance
```

## 二、建库和账号

在服务器上以 MySQL root 身份跑一次（先改掉脚本里的密码）：

```bash
cp deploy/init-db.sql /tmp/init-db.sql
vi /tmp/init-db.sql                    # 把 '改成你的密码' 换成真实密码

# 注意：不要写 docker exec -i ... mysql -uroot -p < 文件
# 少了 -t 的时候 mysql 读不到终端，会把重定向进来的 SQL 文件当成密码，报 Access denied
docker cp /tmp/init-db.sql mysql_server:/tmp/init-db.sql
docker exec -it mysql_server mysql -u root -p
```

进去之后在 `mysql>` 提示符下执行：

```sql
source /tmp/init-db.sql;
exit
```

不想进交互界面的话，用环境变量传密码也是一样的效果：

```bash
read -s -p "MySQL root 密码: " MYSQL_ROOT_PW; echo
docker exec -i -e MYSQL_PWD="$MYSQL_ROOT_PW" mysql_server mysql -u root < /tmp/init-db.sql
unset MYSQL_ROOT_PW
```

这台服务器上 MySQL 的容器名是 `mysql_server`（镜像 mysql:8.0），`.env` 里的 `DB_HOST` 已经按这个名字预填好了。

顺手确认一下它在哪个网络里：

```bash
docker inspect mysql_server --format '{{range $k, $v := .NetworkSettings.Networks}}{{$k}} {{end}}'
```

输出里有 `app_net` 就行。如果没有，把 `.env` 里的 `DB_HOST` 改成 `host.docker.internal`（compose 里已经配好了这个别名）。

## 三、填 .env

```bash
cp .env.example .env
vi .env
```

要改的只有这几项：

```
DB_HOST=mysql_server      # MySQL 的容器名
DB_PASSWORD=你的数据库密码
DB_NAME=attendance
APP_SECRET=一串随机字符     # 可以用 openssl rand -hex 32 生成
CODE_MOM=妈妈的口令         # 至少 4 位
CODE_DAD=爸爸的口令
PORT=3000                 # 别改，前端的接口请求是打到 3000 的
```

`DB_DRIVER` 保持 `mysql`（`memory` 是本地预览用的，重启就清空）。

## 四、起容器

```bash
bash deploy/deploy.sh
```

脚本会检查环境、构建镜像、启动容器，然后等健康检查通过。首次启动会自动建表，并预填一份学期和国定假期。

手动跑也可以：

```bash
docker compose build
docker compose up -d
docker compose logs -f attendance
```

## 五、Nginx Proxy Manager

新增一个 Proxy Host：

| 字段 | 值 |
|---|---|
| Domain Names | `attendance.你的域名.com` |
| Scheme | `http` |
| Forward Hostname | `attendance` |
| Forward Port | `3000` |
| Block Common Exploits | 开 |
| Websockets Support | 不用开 |
| SSL | 申请 Let's Encrypt 证书，勾 Force SSL |

保存后等证书签发（几十秒），然后浏览器打开域名，用 `CODE_MOM` 登录。

## 六、手机加到主屏

手机上用 Safari / Chrome 打开域名 → 输入口令 → 分享菜单里选"添加到主屏幕"。之后从桌面图标进就是全屏无地址栏，观感跟原生 App 一样，打卡和保存报告卡都在这里做。

## 验证清单

部署完挨个点一遍：

- [ ] 浏览器打开域名，出现登录页
- [ ] 输错口令提示"口令不对"，输对能进去
- [ ] 主屏点「今天去了」，刷新后还是这个状态
- [ ] 手机上也打卡一次，电脑上刷新能看到同一条
- [ ] 设置页把开学日改成真实日期，统计数字立刻变化
- [ ] 统计页能生成学期报告卡并保存图片
- [ ] 导出 CSV，Excel 打开不乱码

## 常见问题

**拉不到基础镜像 / 构建特别慢**
阿里云拉 Docker Hub 经常超时。给 docker 配镜像加速（阿里云容器镜像服务的加速地址），或者构建时换 npm 源：

```bash
docker compose build --build-arg NPM_REGISTRY=https://registry.npmmirror.com
```

**容器起来了但一直 unhealthy**

```bash
docker compose logs --tail=50 attendance
```

日志里会有"连不上数据库，已重试 N 次"这种提示，通常是 `DB_HOST` 写错（要写容器名不是 IP）、账号没建、或密码不对。手工验一下：

```bash
docker exec -it mysql mysql -uattendance -p -e "show databases;"
```

**报 caching_sha2_password / 认证插件相关的错**
MySQL 8 默认用 `caching_sha2_password`。如果连不上，把账号改成老的插件形式：

```sql
ALTER USER 'attendance'@'%' IDENTIFIED WITH mysql_native_password BY '你的密码';
FLUSH PRIVILEGES;
```

**NPM 里 502 Bad Gateway**
Forward Hostname 要填容器的名字 `attendance`（不是 IP），并且确认 `attendance` 和 NPM 都在 `app_net` 里：

```bash
docker inspect attendance --format '{{json .NetworkSettings.Networks}}'
docker inspect nginx-proxy-manager --format '{{json .NetworkSettings.Networks}}'
```

**改了代码怎么更新**

```bash
bash deploy/deploy.sh --pull
```

数据在 MySQL 里，重建容器不会丢。

**数据备份**
统计页可以导出 JSON 备份，设置页能导回来（按日期合并）。数据库层面也可以直接 `mysqldump attendance`。
