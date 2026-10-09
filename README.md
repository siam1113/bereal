# COMMON

> Every skill deserves to be seen.

A people-first professional discovery and relationship network for every kind of skill —
trades, arts, agriculture, healthcare-adjacent care, and technology alike.

Full documentation lives in [`docs/`](./docs/README.md) — product thesis, architecture,
data model, design system, dev setup, testing, deployment, and documented decisions.
[`docs/roadmap/`](./docs/roadmap/README.md) holds the longer-term direction beyond V1,
broken into independent workstreams. This file is just the quickstart.

## Stack

Next.js 16 (App Router) + TypeScript + Tailwind v4, PostgreSQL + Prisma 6, Auth.js v5
(Credentials provider), pnpm.

## Quickstart

```bash
cp .env.example .env          # defaults already match docker-compose.yml
docker compose up -d          # starts Postgres on localhost:5434
pnpm install
pnpm db:migrate                # applies prisma/migrations
pnpm db:seed                   # seeds demo accounts across every skill category
pnpm dev                       # http://localhost:3000
```

All seeded demo accounts share the password `Passw0rd!2026`, e.g.
`rashid.carpenter@demo.common.app` or `admin@demo.common.app` (platform admin, `/admin`).
Full list and details: [`docs/dev-setup.md`](./docs/dev-setup.md).

## Scripts

| Script | Purpose |
| --- | --- |
| `pnpm dev` | Start the dev server |
| `pnpm build` / `pnpm start` | Production build / run |
| `pnpm lint` / `pnpm typecheck` | ESLint / `tsc --noEmit` |
| `pnpm test` | Vitest — see [`docs/testing.md`](./docs/testing.md) |
| `pnpm db:migrate` / `pnpm db:deploy` / `pnpm db:seed` / `pnpm db:studio` | Prisma |

See [`docs/dev-setup.md`](./docs/dev-setup.md) for the full script table and environment
variable reference, [`docs/deployment.md`](./docs/deployment.md) for production
deployment, and [`docs/decisions.md`](./docs/decisions.md) for what's deliberately
simplified in V1 and what's still open.
