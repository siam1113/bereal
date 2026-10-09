# COMMON

> Every skill deserves to be seen.

A people-first professional discovery and relationship network for every kind of skill —
trades, arts, agriculture, healthcare-adjacent care, and technology alike. This is the V1
build described in `01_V1_BUILD_PLAN.md`; see `IMPLEMENTATION_PLAN.md` for the technical
plan, file/route ownership map, and documented assumptions.

## Stack

Next.js 16 (App Router) + TypeScript + Tailwind v4, PostgreSQL + Prisma 6, Auth.js v5
(Credentials provider), pnpm.

## Local setup

```bash
cp .env.example .env          # defaults already match docker-compose.yml
docker compose up -d          # starts Postgres on localhost:5434
pnpm install
pnpm db:migrate                # applies prisma/migrations
pnpm db:seed                   # seeds demo accounts across every skill category
pnpm dev                       # http://localhost:3000
```

All seeded demo accounts (see `prisma/seed.ts`) share the password `Passw0rd!2026`, e.g.:

- `rashid.carpenter@demo.common.app` — carpenter, established
- `sadia.engineer@demo.common.app` — backend engineer, established
- `farida.farmer@demo.common.app` — organic farmer, established
- `admin@demo.common.app` — platform admin (`/admin`)

`pnpm db:seed` is safe to run repeatedly — it's written to be idempotent. To wipe and
start over: `pnpm exec prisma migrate reset` (drops the local DB, reapplies migrations,
reseeds).

### Object storage

Local dev defaults to `STORAGE_DRIVER=local`, writing uploads under `.data/media` and
serving them from `/media/*` — no extra service needed (Docker Hub's MinIO images now
require authenticated pulls, so MinIO was dropped from `docker-compose.yml`; see
`IMPLEMENTATION_PLAN.md` section 8). Set `STORAGE_DRIVER=s3` and the matching `S3_*`
variables in production to target any real S3-compatible bucket.

### Email

Without `RESEND_API_KEY` set, outgoing email (verification, password reset) logs to the
console instead of sending — expected in local dev, not a bug.

## Scripts

| Script | Purpose |
| --- | --- |
| `pnpm dev` | Start the dev server |
| `pnpm build` / `pnpm start` | Production build / run |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm test` | Vitest (integration tests hit the real local Postgres — see below) |
| `pnpm test:e2e` | Playwright (config not yet added — see Testing) |
| `pnpm db:migrate` | `prisma migrate dev` |
| `pnpm db:deploy` | `prisma migrate deploy` (production) |
| `pnpm db:seed` | Run `prisma/seed.ts` |
| `pnpm db:studio` | Prisma Studio |

## Testing

`pnpm test` runs Vitest integration tests against your local Postgres (same `DATABASE_URL`
as `pnpm dev`) — they create their own throwaway users/skills and clean up after
themselves; no mocking the database. Current coverage focuses on the plan's
non-negotiable relationship invariants (`src/lib/services/__tests__/relationship-service.test.ts`):
a self-declared relationship can't be confirmed by its own declarer, confirmation
requires the counterpart, visibility changes only ever touch the acting participant's
own row, and endorsement verification status is recomputed server-side from the
relationship's real confirmation state.

**Known gap**: this covers the most safety-critical invariant end to end but not every
non-negotiable test case listed in plan section 7, and `playwright.config.ts` hasn't been
added yet — a real next step before calling V1 test coverage complete, not a decision to
skip it.

## Deployment

A `Dockerfile` builds a Next.js standalone production image (multi-stage: install →
`prisma generate` → `next build` → slim `node:22-alpine` runtime). It follows the
standard documented Next.js-standalone-plus-Prisma pattern but **hasn't been validated
with an actual `docker build` run in this build session** — the directly-verified path is
`pnpm build && pnpm start` against a reachable `DATABASE_URL`. Treat the Docker path as
reasonable-but-unverified until someone runs it.

Either way, before starting the app in production:

```bash
pnpm db:deploy     # prisma migrate deploy — never `migrate dev` in production
pnpm db:seed       # optional — demo data; skip for a real deployment
pnpm build
pnpm start
```

Required environment variables are documented in `.env.example`. Generate `AUTH_SECRET`
with `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`.

## Known V1 limitations

See `IMPLEMENTATION_PLAN.md` section 8 for the full list of documented assumptions
(Prisma version pin, local storage driver, proxied uploads, soft-delete accounts,
simplified professional-stage rules, `ILIKE`-based search). Additionally:

- No UI yet for editing `PersonProfile.contactPreference` (schema field exists, unused).
- `Post.visibility: CONNECTIONS` is currently treated as "any signed-in viewer" rather
  than checking the actual relationship graph, to keep the social vertical buildable
  independently of the relationships vertical during parallel development.
- Playwright e2e coverage for the full "Non-negotiable V1 test cases" list (plan section
  7) is not yet written.
