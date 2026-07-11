# Stage 1: Build packages
FROM node:20-slim AS builder
WORKDIR /app
RUN npm install -g turbo
COPY . .
RUN turbo prune --scope=api --docker

# Stage 2: Install dependencies & compile
FROM node:20-slim AS installer
RUN apt-get update -y && apt-get install -y openssl
WORKDIR /app
COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/package-lock.json ./package-lock.json
RUN npm clean-install

COPY --from=builder /app/out/full/ .
RUN npx prisma generate --schema=packages/database/prisma/schema.prisma
RUN npx turbo run build --filter=api

# Stage 3: Run app
FROM node:20-slim AS runner
RUN apt-get update -y && apt-get install -y openssl
WORKDIR /app
ENV NODE_ENV=production
RUN groupadd --system --gid 1001 nodejs
RUN useradd --system --uid 1001 -g nodejs nestjs
USER nestjs

COPY --from=installer /app/apps/api/package.json ./apps/api/package.json
COPY --from=installer /app/node_modules ./node_modules
COPY --from=installer /app/apps/api/dist ./apps/api/dist
COPY --from=installer /app/packages/database ./packages/database

EXPOSE 4000
CMD ["node", "apps/api/dist/main"]
