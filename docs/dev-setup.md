# Development setup

## Prerequisites

- Node.js 22+, pnpm (`packageManager` is pinned in `package.json`).
- Docker (for local Postgres via `docker-compose.yml`).

## First-time setup

```bash
cp .env.example .env            # defaults already match docker-compose.yml
docker compose up -d            # starts Postgres on localhost:5434
pnpm install
pnpm db:migrate                 # applies prisma/migrations
pnpm db:seed                    # seeds demo accounts across every skill category
pnpm dev                        # http://localhost:3000
```

`pnpm db:seed` is idempotent — safe to run again. To wipe and start over entirely:
`pnpm exec prisma migrate reset` (drops the local DB, reapplies migrations, reseeds).
This is a genuinely destructive command — it's gated behind an explicit confirmation
prompt from Prisma itself when run by an AI agent; a human running it directly just
gets the normal Prisma confirmation prompt.

## Demo accounts

All seeded accounts (`prisma/seed.ts`) share the password `Passw0rd!2026`:

| Email | Role |
| --- | --- |
| `admin@demo.proverse.app` | Platform admin — `/admin` |
| `rashid.carpenter@demo.proverse.app` | Carpenter, established, owns a business |
| `amina.tailor@demo.proverse.app` | Tailor, practicing |
| `hasan.electrician@demo.proverse.app` | Electrician, emerging |
| `farida.farmer@demo.proverse.app` | Organic farmer, established |
| `kamal.agronomist@demo.proverse.app` | Agronomy consultant, practicing |
| `nusrat.wellness@demo.proverse.app` | Wellness coach, emerging |
| `tariq.painter@demo.proverse.app` | Painter, learning |
| `sadia.engineer@demo.proverse.app` | Backend engineer, established |
| `imran.frontend@demo.proverse.app` | Frontend engineer, practicing |
| `mitu.consultant@demo.proverse.app` | Small business consultant, practicing |

The seed also creates a representative spread of relationship states: a
`MUTUALLY_CONFIRMED` `WORKED_WITH` (Rashid ↔ Hasan, with confirmed feedback), a
`SELF_DECLARED` `LEARNING_FROM` (Tariq → Amina, with an unverified endorsement riding on
it), and a disputed `CONSULTANT_CLIENT` (Kamal ↔ Farida).

## Environment variables

See `.env.example` for the full annotated list. The main groups:

- **Database** — `DATABASE_URL`.
- **Auth.js** — `AUTH_SECRET` (generate with
  `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`),
  `NEXTAUTH_URL`.
- **Object storage** — `STORAGE_DRIVER` (`local` or `s3`), plus either
  `LOCAL_STORAGE_DIR`/`LOCAL_STORAGE_PUBLIC_PATH` or the `S3_*` variables.
- **Email** — `RESEND_API_KEY` (optional — unset logs emails to the console instead),
  `EMAIL_FROM`.

## Scripts

| Script | Purpose |
| --- | --- |
| `pnpm dev` | Dev server (Turbopack) |
| `pnpm build` / `pnpm start` | Production build / run |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm test` / `pnpm test:watch` | Vitest |
| `pnpm test:e2e` | Playwright (see [testing.md](./testing.md) — not fully set up yet) |
| `pnpm db:migrate` | `prisma migrate dev` |
| `pnpm db:deploy` | `prisma migrate deploy` (production — never `migrate dev` there) |
| `pnpm db:seed` | Run `prisma/seed.ts` |
| `pnpm db:studio` | Prisma Studio, a GUI over the local database |
| `pnpm format` | Prettier |

## Ports

The dev server defaults to `:3000`; if that's taken, Next.js picks the next free port
and logs it (check the terminal output). Postgres runs on host port `5434` (not the
default `5432`) to avoid colliding with other local projects — see `docker-compose.yml`.

## Working on a single feature area

If you're picking up work in one of the five feature areas described in
[architecture.md](./architecture.md#feature-areas-and-their-service-files), you
generally only need to touch that area's route folder(s) and service file(s) — the
service layer is where the logic and the invariants from
[data-model.md](./data-model.md) live, and pages/API routes should stay thin wrappers
over it.
