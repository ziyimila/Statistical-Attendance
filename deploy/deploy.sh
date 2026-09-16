#!/usr/bin/env bash
# 服务器上的一键部署（在仓库根目录执行：bash deploy/deploy.sh）
#
#   bash deploy/deploy.sh          构建 + 启动 + 等健康检查
#   bash deploy/deploy.sh --pull   先 git pull 再构建
#
# 需要先准备好：.env（照 .env.example 填）、app_net 网络、attendance 库

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

fail() { echo "✗ $1" >&2; exit 1; }
ok() { echo "✓ $1"; }

echo "== 1/6 环境检查 =="
command -v docker >/dev/null 2>&1 || fail "这台机器上没有 docker"
docker compose version >/dev/null 2>&1 || fail "docker 没有 compose 插件（docker compose version 跑不通）"
ok "docker $(docker --version | awk '{print $3}' | tr -d ',')"

docker network inspect app_net >/dev/null 2>&1 || fail "找不到 app_net 网络，确认 MySQL 那套容器已经起来了"
ok "app_net 网络存在"

[ -f .env ] || fail "缺少 .env，先执行：cp .env.example .env 然后填好里面的值"
set -a
# shellcheck disable=SC1091
. ./.env
set +a

for key in DB_HOST DB_USER DB_PASSWORD DB_NAME APP_SECRET CODE_MOM CODE_DAD; do
  eval "value=\${$key:-}"
  [ -n "$value" ] || fail ".env 里的 $key 是空的"
done
case "$DB_PASSWORD$APP_SECRET$CODE_MOM$CODE_DAD" in
  *"改成"*) fail ".env 里还有占位符没改成真实值" ;;
esac
ok ".env 看起来填好了（数据库：$DB_USER@$DB_HOST/$DB_NAME）"

echo
echo "== 2/6 检查数据库能不能连上 =="
database_networks="$(docker inspect "$DB_HOST" --format '{{range $name, $conf := .NetworkSettings.Networks}}{{$name}} {{end}}' 2>/dev/null || true)"
if [ -z "$database_networks" ]; then
  echo "  找不到名为 $DB_HOST 的容器，确认 .env 里的 DB_HOST 写的是容器名"
elif printf '%s' "$database_networks" | grep -qw app_net; then
  ok "$DB_HOST 也在 app_net 里，容器之间可以直接按名字访问"
else
  echo "  ⚠ $DB_HOST 不在 app_net 里（它在：$database_networks）"
  echo "    应用容器还是能起，但可能连不上；这种情况把 .env 里的 DB_HOST 改成 host.docker.internal"
fi

if docker exec "$DB_HOST" mysql -u"$DB_USER" -p"$DB_PASSWORD" -e "USE \`$DB_NAME\`" >/dev/null 2>&1; then
  ok "数据库 $DB_NAME 可以连通"
else
  echo "  连不上（可能容器名不对、账号没建、或者密码不对）。继续走，起容器时会自动重试 10 次。"
fi

if [ "${1:-}" = "--pull" ]; then
  echo
  echo "== 3/6 拉最新代码 =="
  git pull --ff-only && ok "代码已更新"
else
  echo
  echo "== 3/6 跳过 git pull（要更新代码加 --pull）=="
fi

echo
echo "== 4/6 构建镜像（第一次会比较慢）=="
docker compose build || fail "镜像构建失败，看上面的报错；国内服务器可以试：docker compose build --build-arg NPM_REGISTRY=https://registry.npmmirror.com"
ok "镜像构建完成"

echo
echo "== 5/6 启动 =="
docker compose up -d

echo
echo "== 6/6 等健康检查 =="
healthy=false
for _ in $(seq 1 20); do
  sleep 3
  status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' attendance 2>/dev/null || echo missing)"
  case "$status" in
    healthy) ok "容器健康"; healthy=true; break ;;
    unhealthy) echo "  容器不健康，最近日志："; docker compose logs --tail=40 attendance; fail "启动失败" ;;
    missing) fail "容器没起来，日志：$(docker compose logs --tail=40 attendance)" ;;
    *) printf '  当前状态：%s，继续等…\n' "$status" ;;
  esac
done

docker compose ps
if [ "$healthy" != true ]; then
  echo
  echo "⚠ 60 秒内没等到健康状态，自己看一眼：docker compose logs --tail=50 attendance"
fi
echo
echo "接下来：去 Nginx Proxy Manager 加一个 Proxy Host 指向 attendance:3000，然后浏览器打开域名，用 .env 里的 CODE_MOM 登录。"
