# 基础镜像。国内拉不到 docker.io 时，在 .env 里加一行换源即可：
#   BASE_IMAGE=docker.nju.edu.cn/library/node:24-alpine
ARG BASE_IMAGE=node:24-alpine

# ---- 构建阶段：编译前端和后端 ----
FROM ${BASE_IMAGE} AS build
WORKDIR /app

# npm 源，国内也可以换：NPM_REGISTRY=https://registry.npmmirror.com
ARG NPM_REGISTRY=https://registry.npmjs.org/

COPY package.json package-lock.json ./
COPY server/package.json server/
COPY web/package.json web/
RUN npm ci --registry=$NPM_REGISTRY

COPY . .
RUN npm run build

# ---- 运行阶段：只留生产依赖和构建产物 ----
FROM ${BASE_IMAGE} AS runtime
ENV NODE_ENV=production
ENV TZ=Asia/Shanghai
WORKDIR /app

ARG NPM_REGISTRY=https://registry.npmjs.org/

# 单独装一份生产依赖，不去搬构建阶段那一堆 dev 依赖和 workspace 布局
COPY package.json package-lock.json ./
COPY server/package.json server/
COPY web/package.json web/
RUN npm ci --omit=dev --registry=$NPM_REGISTRY && npm cache clean --force

COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/web/dist ./web/dist

EXPOSE 3000
USER node
CMD ["node", "server/dist/index.js"]
