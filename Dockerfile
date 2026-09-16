# ---- 构建阶段：编译前端和后端 ----
FROM node:24-alpine AS build
WORKDIR /app

# 国内服务器可以传 --build-arg NPM_REGISTRY=https://registry.npmmirror.com 加速
ARG NPM_REGISTRY=https://registry.npmjs.org/

COPY package.json package-lock.json ./
COPY server/package.json server/
COPY web/package.json web/
RUN npm ci --registry=$NPM_REGISTRY

COPY . .
RUN npm run build

# ---- 运行阶段：只留生产依赖和构建产物 ----
FROM node:24-alpine AS runtime
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
