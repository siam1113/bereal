# Architecture

## Stack

- **Framework**: Next.js 16 (App Router), TypeScript (strict), Tailwind v4.
- **Package manager**: pnpm (not npm/yarn — `packageManager` is pinned in `package.json`).
- **Database**: PostgreSQL 16 + Prisma 6.19 (see [decisions.md](./decisions.md) for why
  not Prisma 7). Schema: `prisma/schema.prisma`.
- **Auth**: Auth.js v5 (`next-auth@beta`), Credentials provider, JWT sessions, Prisma
  adapter wired for future OAuth providers.
- **UI**: Radix UI primitives wrapped in `src/components/ui/*`, styled with Tailwind
  tokens — see [design-system.md](./design-system.md).
- **Validation**: Zod on every API route body.
- **Testing**: Vitest (integration, against a real local Postgres), Playwright
  (configured but not yet populated — see [testing.md](./testing.md)).

## Layering

```
page.tsx / route.ts            ← thin: auth check, parse input, call a service, render
        │
src/lib/services/*.ts          ← business logic, invariant enforcement, Prisma calls
        │
src/lib/prisma.ts               ← Prisma client singleton
        │
PostgreSQL (prisma/schema.prisma)
```

Pages and API routes should stay thin. Authorization checks
(`requireUser()`/`requireAdmin()` from `src/lib/auth-helpers.ts`) and all Prisma calls
belong in the service layer under `src/lib/services/`, not scattered across routes —
that's where the non-negotiable invariants in [data-model.md](./data-model.md) actually
get enforced, and where tests target them.

## Directory map

```
prisma/
  schema.prisma          ← single source of truth for the data model
  migrations/
  seed.ts                 ← idempotent demo-data seed (pnpm db:seed)

src/
  app/                    ← Next.js App Router: one folder per route
    api/                  ← route handlers (REST-ish JSON endpoints)
    admin/                ← admin dashboard pages (server actions, not /api/admin/*)
    ...                   ← every other top-level route folder is a page tree
  components/
    ui/                   ← accessible primitives (Button, Card, Dialog, Select, ...)
    <feature>/             ← feature-specific components (feed/, relationships/, ...)
  lib/
    services/              ← business logic — see table below
    auth.ts, auth-helpers.ts, auth-tokens.ts, password.ts
    storage/                ← pluggable media storage (local disk or S3)
    prisma.ts, mail.ts, rate-limit.ts, audit.ts, slug.ts, utils.ts
  proxy.ts                ← route guard middleware (Next 16 renamed "middleware.ts")

docs/                      ← you are here
```

## Feature areas and their service files

The app was built as five largely-independent feature areas, each owning its own route
folders and service files so they could be developed without touching the same files.
That separation is still a useful map of the codebase. A sixth area (Learning &
mentorship) was added later as Year-2+ roadmap Track 5 — see
[roadmap/05-learning-and-mentorship.md](./roadmap/05-learning-and-mentorship.md):

| Area | Routes | Services |
| --- | --- | --- |
| **Identity & profiles** | `/login`, `/signup`, `/onboarding`, `/p/[slug]`, `/business/[slug]`, `/settings/{profile,portfolio,experience,businesses}` | `profile-service.ts`, `business-service.ts`, `skill-service.ts`, `portfolio-service.ts`, `experience-service.ts` |
| **Relationships, claims & badges** | `/relationships`, `/relationships/requests`, `/relationships/[id]`, `/claims`, `/claims/[id]`, `/badges/[id]`, `/references`, `/references/[id]` | `relationship-service.ts`, `claim-service.ts`, `badge-service.ts`, `endorsement-service.ts`, `feedback-service.ts`, `reference-service.ts`, `claim-appeal-service.ts` |
| **Relationship-graph extensions** (Track 3 — see [roadmap/03-relationships-and-collaboration.md](./roadmap/03-relationships-and-collaboration.md)) | `/api/relationships/[id]/projects`, `/api/relationships/[id]/networks`, `/api/portfolio/[id]/team-history`, `/api/business-relationships*`, `/api/mentoring-programs*`, `/api/private-networks*` — no dedicated pages yet, API routes only | `team-history-service.ts`, `business-relationship-service.ts`, `mentoring-service.ts`, `private-network-service.ts` |
| **Discovery & opportunities** | `/discover`, `/help-requests`, `/opportunities`, `/services`, `/settings/services` | `search-service.ts`, `help-request-service.ts`, `opportunity-service.ts`, `service-offering-service.ts` |
| **Social & messaging** | `/feed`, `/messages`, `/messages/[conversationId]`, `/notifications` | `post-service.ts`, `follow-service.ts`, `message-service.ts`, `notification-service.ts`, `report-service.ts`, `block-service.ts` |
| **Admin & safety** | `/admin` and its subpages (`skills`, `claims`, `claim-appeals`, `disputes`, `reference-disputes`, `reports`, `badges`, `stage-rules`) — server actions, not a separate `/api/admin/*` tree | `admin-dashboard-service.ts`, `admin-skill-service.ts`, `admin-claim-review-service.ts`, `admin-dispute-service.ts`, `admin-reference-dispute-service.ts`, `admin-report-service.ts`, `admin-badge-service.ts` |
| **Learning & mentorship** | `/mentoring`, `/mentoring/[id]`, `/mentoring/new`, `/mentoring/requests`, `/expert-sessions`, `/expert-sessions/[id]`, `/expert-sessions/new`, `/expert-sessions/mine`, `/learning-circles`, `/learning-circles/[id]`, `/learning-circles/new`, `/learning-circles/mine` | `mentoring-service.ts`, `expert-session-service.ts`, `learning-circle-service.ts` |

Two shared "hand-off" components cross these boundaries by design:

- `src/components/relationships/profile-relationships-panel.tsx` — a self-contained
  server component dropped into `/p/[slug]/page.tsx` to render a profile's visible
  relationships, badges, and endorsements/feedback.
- `src/components/safety/report-button.tsx` — a self-contained client component any
  entity page can drop in to let a signed-in user file a `Report`.

Note the admin claim-review path: `claim-service.ts` (subject-side claim submission)
and `admin-claim-review-service.ts` (admin decision workflow) are deliberately separate
files rather than one shared module — they were built independently and never needed to
share state beyond the `CredentialClaim`/`VerificationReview` tables themselves.

## Auth

`src/lib/auth.ts` configures Auth.js with a Credentials provider (email/password,
bcrypt-hashed) and JWT sessions — the Prisma adapter is wired in for a future OAuth
provider but isn't exercised by the credentials flow today. Helpers in
`src/lib/auth-helpers.ts`:

- `getCurrentUser()` — session user or `null`.
- `requireUser()` — throws `UnauthorizedError` if signed out. Use at the top of any
  mutating route/page.
- `requireAdmin()` — throws `ForbiddenError` if not `ADMIN`/`MODERATOR`.

`src/proxy.ts` (Next 16 renamed the `middleware.ts` convention to `proxy.ts`) redirects
signed-out users away from `/settings`, `/messages`, `/notifications`, `/admin` as a UX
nicety — it is **not** the real authorization boundary. Every sensitive route/page calls
`requireUser()`/`requireAdmin()` itself; treat the proxy guard as defense-in-depth, not
the enforcement point.

Email verification and password reset use dedicated, single-purpose tables
(`EmailVerificationToken`, `PasswordResetToken` — see `src/lib/auth-tokens.ts`) rather
than Auth.js's built-in `VerificationToken`, which is designed around magic-link email
providers we don't use.

## Storage

`src/lib/storage/` abstracts media storage behind a `StorageDriver` interface with two
implementations:

- `local` (default) — writes to `.data/media`, served by `src/app/media/[...path]/route.ts`.
- `s3` — any S3-compatible bucket, selected via `STORAGE_DRIVER=s3` plus the `S3_*` env
  vars.

All uploads go through `POST /api/uploads` (authenticated, validates file type/size via
`src/lib/storage/types.ts`), which proxies the file through the server and writes it via
whichever driver is active — there's no presigned-client-direct-to-bucket path. See
[decisions.md](./decisions.md) for why.

## Mail

`src/lib/mail.ts` sends through Resend when `RESEND_API_KEY` is set; otherwise it logs
the email to the console. This is the expected local-dev behavior, not a bug — it's what
lets you click a verification/reset link straight out of the server log.

## Cross-cutting helpers

- `src/lib/rate-limit.ts` — in-memory fixed-window limiter. Fine for a single-process
  deployment; swap for Redis before running multiple instances.
- `src/lib/audit.ts` — `logAudit()`. Called after claim decisions, relationship
  confirm/dispute resolutions, moderation actions, and badge award/revocation. Writes to
  the `AuditEvent` table.
- `src/lib/slug.ts` — `slugify()`/`uniqueSlug()` for profile and business URLs.
- `src/lib/utils.ts` — `cn()` (clsx + tailwind-merge) for conditional class names.
