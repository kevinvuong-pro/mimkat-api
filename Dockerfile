
FROM node:22.12.0-bookworm-slim AS build

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

ENV DATABASE_URL=postgresql://localhost:5432/mimkat

COPY package*.json ./
RUN npm ci

# Copy source files first
COPY prisma ./prisma
COPY prisma.config.ts ./
COPY nest-cli.json tsconfig*.json ./
COPY src ./src

# Generate Prisma Client
RUN npx prisma generate

# Build NestJS
RUN npm run build

# Verify generated client was compiled
RUN test -f dist/generated/prisma/client.js \
  && test -f dist/generated/prisma/internal/class.js

# --------------------------------

FROM node:22.12.0-bookworm-slim AS runtime

ENV NODE_ENV=production

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

COPY --chown=node:node package*.json ./

RUN npm ci --omit=dev \
  && npm cache clean --force

COPY --from=build --chown=node:node /app/prisma ./prisma
COPY --from=build --chown=node:node /app/prisma.config.ts ./prisma.config.ts
COPY --from=build --chown=node:node /app/dist ./dist

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
