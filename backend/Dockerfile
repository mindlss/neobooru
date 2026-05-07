FROM node:22-bookworm-slim AS builder

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/*

COPY backend/package*.json ./
RUN npm ci

COPY backend/prisma ./prisma
COPY backend/tsconfig.json backend/tsoa.json ./
COPY backend/src ./src

RUN npx prisma generate \
    && npm run build

FROM node:22-bookworm-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/*

COPY backend/package*.json ./
COPY backend/prisma ./prisma

RUN npm ci --omit=dev \
    && npm install --no-save prisma@5.18.0 \
    && npx prisma generate \
    && npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY backend/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

RUN chmod +x /usr/local/bin/docker-entrypoint.sh \
    && mkdir -p /app/logs \
    && chown -R node:node /app

USER node

EXPOSE 3000

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "dist/server.js"]
