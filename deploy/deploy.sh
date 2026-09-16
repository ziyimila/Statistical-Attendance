#!/usr/bin/env bash
# 服务器上的一键部署（在仓库根目录执行：bash deploy/deploy.sh）
#
#   bash deploy/deploy.sh          检查 + 构建 + 启动 + 等健康检查
#   bash deploy/deploy.sh --pull   先 git pull 再构建
#
# 需要先准备好：.env（照 .env.example 填）、app_net 网络、attendance 库

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

fail() { echo "✗ $1" >&2; exit 1; }
ok() { echo "✓ $1"; }
warn() { echo "⚠ $1"; }

echo "== 1/7 环境检查 =="
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

if [ -n "${BASE_IMAGE:-}" ] || [ -n "${NPM_REGISTRY:-}" ]; then
  warn "用了自定义构建源：BASE_IMAGE=${BASE_IMAGE:-默认} NPM_REGISTRY=${NPM_REGISTRY:-默认}"
fi

echo
echo "== 2/7 检查数据库 =="
database_networks="$(docker inspect "$DB_HOST" --format '{{range $name, $conf := .NetworkSettings.Networks}}{{$name}} {{end}}' 2>/dev/null || true)"
if [ -z "$database_networks" ]; then
  echo "  找不到名为 $DB_HOST 的容器，确认 .env 里的 DB_HOST 写的是容器名"
elif printf '%s' "$database_networks" | grep -qw app_net; then
  ok "$DB_HOST 也在 app_net 里，容器之间可以直接按名字访问"
else
  warn "$DB_HOST 不在 app_net 里（它在：$database_networks），把 .env 里的 DB_HOST 改成 host.docker.internal 试试"
fi

if docker exec "$DB_HOST" mysql -u"$DB_USER" -p"$DB_PASSWORD" -e "USE \`$DB_NAME\`" >/dev/null 2>&1; then
  ok "数据库 $DB_NAME 可以连通"
else
  warn "连不上数据库（容器名、账号或密码可能不对）。继续走，起容器时会自动重试 10 次。"
fi

echo
echo "== 3/7 找可用的基础镜像 =="
base_image="${BASE_IMAGE:-node:24-alpine}"
if docker image inspect "$base_image" >/dev/null 2>&1; then
  ok "本地已有 $base_image"
else
  pull_log="$(mktemp)"
  candidates=("$base_image")
  for mirror in docker.1ms.run docker.m.daocloud.io hub.rat.dev; do
    candidates+=("$mirror/library/node:24-alpine")
  done

  found=""
  for candidate in "${candidates[@]}"; do
    printf '  试 %-46s ' "$candidate"
    if docker pull "$candidate" >"$pull_log" 2>&1; then
      echo "✓"
      found="$candidate"
      break
    fi
    echo "✗"
  done

  if [ -z "$found" ]; then
    echo
    echo "所有源都拉不动。最后一次的原始报错："
    echo "--------------------------------------------------------------"
    tail -n 15 "$pull_log"
    echo "--------------------------------------------------------------"
    echo
    echo "把上面这段发出来。顺手再跑这两条，能判断是不是 docker 没走服务器上的代理："
    echo "  docker info | grep -i proxy"
    echo "  cat /etc/docker/daemon.json 2>/dev/null || echo '(没有 daemon.json)'"
    exit 1
  fi

  # 这次构建就用它；compose 读的是环境变量，会盖过 .env 里的值
  export BASE_IMAGE="$found"
  ok "这次用 $found 构建"
  echo "  建议把这行加到 .env 里固化下来，下次不用再试："
  echo "    BASE_IMAGE=$found"
fi

if [ "${1:-}" = "--pull" ]; then
  echo
  echo "== 4/7 拉最新代码 =="
  git pull --ff-only && ok "代码已更新"
else
  echo
  echo "== 4/7 跳过 git pull（要更新代码加 --pull）=="
fi

echo
echo "== 5/7 构建镜像（第一次慢，装前后端依赖）=="
docker compose build || fail "镜像构建失败，看上面的报错"
ok "镜像构建完成"

echo
echo "== 6/7 启动 =="
docker compose up -d

echo
echo "== 7/7 等健康检查 =="
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
  warn "60 秒内没等到健康状态，自己看一眼：docker compose logs --tail=50 attendance"
fi
echo
echo "接下来：去 Nginx Proxy Manager 加一个 Proxy Host 指向 attendance:3000，然后浏览器打开域名，用 .env 里的 CODE_MOM 登录。"
