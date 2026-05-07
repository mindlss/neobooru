FROM node:22-bookworm-slim AS builder

WORKDIR /app

COPY frontend/package*.json ./
RUN npm ci --legacy-peer-deps

COPY frontend/index.html frontend/tsconfig*.json frontend/vite.config.ts frontend/orval.config.ts ./
COPY frontend/src ./src
COPY openapi /openapi

RUN npm run build

FROM nginx:1.27-alpine AS frontend

COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
