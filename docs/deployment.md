# Deployment

## Without Docker (verified)

```bash
pnpm db:deploy     # prisma migrate deploy — never `migrate dev` in production
pnpm db:seed       # optional: demo data — skip for a real deployment
pnpm build
pnpm start
```

Set the environment variables documented in `.env.example` (and
[dev-setup.md](./dev-setup.md#environment-variables)) in your hosting environment.
For production, set `STORAGE_DRIVER=s3` and the matching `S3_*` variables rather than
relying on the `local` filesystem driver, which only makes sense for a single
long-lived instance with persistent disk.

This path — `pnpm build && pnpm start` against a reachable `DATABASE_URL` — is what was
actually exercised during the build (production build ran clean, every route confirmed
server-rendered on demand).

## With Docker (pattern-correct, not yet run end-to-end)

A multi-stage `Dockerfile` builds the Next.js `standalone` output
(`next.config.ts` sets `output: "standalone"`):

```bash
docker build -t common-app .
docker run -p 3000:3000 --env-file .env common-app
```

It does **not** run migrations itself — run `pnpm db:deploy` against the target
database as a separate release step before starting the container (or before pointing
traffic at a new one). This follows the standard, widely-documented
Next.js-standalone-plus-Prisma pattern (output tracing follows pnpm's symlinks into the
real `.pnpm` store, so the generated Prisma client — including its platform-specific
query-engine binary, built for linux-musl since the whole build runs inside
`node:22-alpine` — ends up correctly bundled without any extra `COPY` steps). It has
**not been validated with an actual `docker build` run** in this project's build
history — treat it as reasonable-but-unverified until someone runs it for real.

## Database

- Always `prisma migrate deploy` in production, never `migrate dev` (which can prompt
  interactively and isn't meant for non-dev environments).
- `prisma migrate reset` is explicitly destructive and gated — don't run it against
  anything but a local/dev database.

## What's missing for a real production launch

This is a V1 build, not a hardened production deployment. Before actually launching
publicly, see [decisions.md](./decisions.md) for the open product/governance questions,
and note that there is currently no CI pipeline, no error-tracking/observability
integration, and no load-tested rate limiting (the in-memory limiter in
`src/lib/rate-limit.ts` is explicitly single-process-only).
