# syntax=docker/dockerfile:1
#
# Multi-stage build for the Next.js standalone server output. Run `pnpm prisma migrate
# deploy` against the target database separately (e.g. as a release step) before
# starting this container — it does not run migrations itself.

FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm prisma generate
RUN pnpm build

FROM base AS runner
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
# Next.js's output tracing follows pnpm's symlinks into the real .pnpm store files, so
# the generated Prisma client (including its platform-specific query-engine binary,
# built for linux-musl since this whole build runs inside node:22-alpine) is already
# included under .next/standalone/node_modules — nothing extra to copy here.

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
