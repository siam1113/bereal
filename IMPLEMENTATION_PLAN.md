# COMMON — Implementation Plan

Status source of truth for build progress. Product spec: `01_V1_BUILD_PLAN.md` (read it
first — section/letter references below point back to it). Vision context: `02_FIVE_YEAR_VISION.md`.

## 1. Stack (decided, do not relitigate)

- Next.js 16 App Router + TypeScript (strict) + Tailwind v4, package manager **pnpm**.
- PostgreSQL 16 + Prisma 6.19 ORM. Schema at `prisma/schema.prisma` — already migrated
  (`prisma/migrations/20261009145712_init`). **Do not edit models already in the schema
  without checking with the other verticals** — additive migrations only (new models/
  fields are fine via `pnpm db:migrate`; renaming/removing existing fields breaks other
  verticals mid-build).
- Auth: Auth.js v5 (`next-auth@beta`) Credentials provider, JWT sessions, Prisma adapter
  wired for future OAuth. See `src/lib/auth.ts`, `src/lib/auth-helpers.ts` (`requireUser()`,
  `requireAdmin()`, `getCurrentUser()`), `src/lib/auth-tokens.ts` (email verify / password
  reset), `src/lib/password.ts`.
- Storage: driver-abstracted (`src/lib/storage`), `STORAGE_DRIVER=local` by default (writes
  under `.data/media`, served at `/media/*`), `s3` driver ready for production (any
  S3-compatible bucket). Upload everything through `POST /api/uploads` (authenticated,
  multipart `file` field, returns `{ url, key }`) — don't call the storage driver directly
  from route handlers for user-facing uploads.
- Email: `src/lib/mail.ts`. Without `RESEND_API_KEY` set, emails log to the console —
  this is the expected local-dev behavior, not a bug.
- UI: accessible Radix-based primitives in `src/components/ui/*` (Button, Input, Textarea,
  Label, Card, Badge, Avatar, Dialog, Select, Tabs, Checkbox, Switch, DropdownMenu,
  Popover, Toaster/`toast()`). **Reuse these — don't hand-roll new buttons/inputs/dialogs.**
  Design tokens (colors, radii, fonts) live in `src/app/globals.css` as CSS variables
  consumed via Tailwind v4 `@theme inline` — use the semantic classes (`bg-paper`,
  `text-ink`, `text-ink-muted`, `bg-accent`, `border-border`, `font-display` for headings,
  default `font-sans` for body) rather than introducing new raw hex colors.
- Cross-cutting helpers: `src/lib/rate-limit.ts` (in-memory fixed-window — use on any
  public write endpoint prone to abuse: auth, report submission, requests), `src/lib/audit.ts`
  (`logAudit()` — call this after claim decisions, relationship confirm/dispute
  resolutions, moderation actions, badge award/revocation), `src/lib/slug.ts` (`uniqueSlug()`),
  `src/lib/utils.ts` (`cn()`).
- Testing: Vitest (unit/integration — `pnpm test`), Playwright (e2e — `pnpm test:e2e`,
  config not yet created — first vertical that adds e2e tests should add
  `playwright.config.ts` pointed at `http://localhost:3000`). Lint: `pnpm lint`. Types:
  `pnpm typecheck`.

## 2. Non-negotiable product invariants (enforce in the service layer, not just UI)

These come directly from plan section 2 and the "Non-negotiable V1 test cases" (section 7).
Any vertical touching relationships/claims/endorsements must uphold them:

1. A `Relationship.confirmationStatus` only advances from `SELF_DECLARED` to
   `MUTUALLY_CONFIRMED` when the **counterpart** (not the declarer) takes an explicit
   confirming action. Never let one party's edit silently flip this.
2. `Endorsement` and `ProfessionalFeedback` require a `relationshipId` establishing prior
   declared work history. `Endorsement.status` stays `UNVERIFIED` unless the underlying
   relationship's `confirmationStatus` is `MUTUALLY_CONFIRMED` or `EVIDENCE_REVIEWED` —
   recompute this at write time, don't trust client input for `status`.
3. Visibility is per-participant (`RelationshipParticipantVisibility`), never a single
   global flag — participant A hiding a relationship must not affect what participant B
   sees on their own profile, and vice versa.
4. `LEARNING_FROM` relationships support one-sided declaration; never render them as if
   the named party agreed. `FAMILY` relationships require `counterpartConsent = GRANTED`
   before the counterpart's identity is shown publicly attached to the claim.
5. Multiple concurrent relationship types between the same two users are expected and
   must all render — don't dedupe by `(partyA, partyB)` pair.
6. A `PersonSkill` is either primary (`isPrimary: true`, at most one per profile — enforce
   in the service layer since the DB doesn't) or secondary; secondary skills must be fully
   searchable, not just filterable as an afterthought.
7. `ProfessionalStage` is system-assigned from rules + evidence, never user-settable
   directly and never a single blended "trust score" — show the rationale
   (`PersonSkill.stageRationale`).
8. Exact location is never persisted for display — `approxLat/approxLng` only, already
   deliberately coarse. Don't add a precise-address field anywhere.
9. A claim (`CredentialClaim`) stays `SUBMITTED`/`IN_REVIEW` until an admin
   `VerificationReview` decides it — never auto-approve, even for seed/demo convenience.

## 3. Database schema

Full schema: `prisma/schema.prisma` (single source of truth, already migrated). Entity
groups, matching plan section 6:

- **Auth**: `User`, `Account`, `Session`, `EmailVerificationToken`, `PasswordResetToken`.
- **Identity**: `PersonProfile`, `Business`, `BusinessMembership`, `Skill`, `SkillAlias`,
  `PersonSkill`, `PortfolioItem`, `PortfolioItemSkill`, `ExperienceEntry`.
- **Trust**: `CredentialClaim`, `VerificationReview`, `BadgeDefinition`, `BadgeAward`.
- **Relationship graph**: `Relationship`, `RelationshipRequest`,
  `RelationshipParticipantVisibility`, `RelationshipEvidence`, `RelationshipDispute`,
  `Endorsement`, `ProfessionalFeedback`.
- **Social**: `Post`, `Comment`, `Reaction`, `Follow`.
- **Opportunity layer**: `HelpRequest`, `HelpResponse`, `Opportunity`, `Application`,
  `ServiceOffering`, `Inquiry`.
- **Messaging/notifications**: `Conversation`, `ConversationParticipant`, `Message`,
  `Notification`.
- **Safety/ops**: `Report`, `Block`, `AuditEvent`.

If a vertical needs a field the schema doesn't have: add it additively (new optional
field or new model), run `pnpm db:migrate --name <description>`, and note the addition in
your final report. Don't rename or remove existing fields/models.

## 4. Route & file ownership (parallel build — avoid collisions)

Each vertical owns a distinct set of route folders and service files so five agents can
build concurrently without touching the same file. **Do not edit files outside your own
list below.** If you need something another vertical should expose (e.g., a profile-page
tab), build it as a standalone, self-contained component at the path noted under "hand-off
components" and report it in your summary — the integration pass wires it in.

Shared already built (foundation, don't recreate): `src/lib/prisma.ts`, `src/lib/auth.ts`,
`src/lib/auth-helpers.ts`, `src/lib/auth-tokens.ts`, `src/lib/password.ts`, `src/lib/mail.ts`,
`src/lib/storage/*`, `src/lib/slug.ts`, `src/lib/rate-limit.ts`, `src/lib/audit.ts`,
`src/lib/utils.ts`, `src/components/ui/*`, `src/components/site-header.tsx`,
`src/components/site-footer.tsx`, `src/components/user-menu.tsx`, root layout, `/media`
and `/api/uploads` routes, `/api/auth/*` routes, `src/proxy.ts` (route guards for
`/settings`, `/messages`, `/notifications`, `/admin`).

### Vertical A — Identity & Profiles (plan section 4.A)
Owns:
- `src/app/login/page.tsx`, `src/app/signup/page.tsx`, `src/app/forgot-password/page.tsx`,
  `src/app/reset-password/page.tsx` — client forms against the existing
  `/api/auth/register`, `/api/auth/forgot-password`, `/api/auth/reset-password` routes and
  `signIn("credentials", …)` from `next-auth/react` for login.
- `src/app/onboarding/page.tsx` — post-signup primary/secondary skill picker + basics.
- `src/app/p/[slug]/page.tsx` — public profile (overview, portfolio, experience tabs only;
  leave a `{/* relationships tab: integration */}` comment placeholder, don't build it).
- `src/app/settings/profile/page.tsx`, `.../portfolio/page.tsx` (+ item editor),
  `.../experience/page.tsx`.
- `src/app/business/[slug]/page.tsx`, `src/app/settings/businesses/page.tsx` (+ `[id]` editor
  and membership management/confirmation).
- `src/app/api/profiles/*`, `src/app/api/portfolio/*`, `src/app/api/experience/*`,
  `src/app/api/businesses/*`, `src/app/api/skills/*` (search + free-text suggestion queue).
- `src/lib/services/profile-service.ts`, `business-service.ts`, `skill-service.ts`,
  `portfolio-service.ts`, `experience-service.ts`.
- Hand-off component: `src/components/claims/claim-list-placeholder.tsx` not needed — skip;
  profile page just omits the claims/badges section (integration adds it).
Explicitly NOT owned: service offerings (Vertical C owns `ServiceOffering` end to end,
including the "manage my services" settings page), relationships/claims/badges
(Vertical B).

### Vertical B — Relationships, claims & badges (plan section 4.B)
Owns:
- `src/app/relationships/page.tsx` (directory of my relationships, grouped by type/state),
  `src/app/relationships/requests/page.tsx` (incoming/outgoing `RelationshipRequest`s),
  `src/app/relationships/[id]/page.tsx` (detail: evidence, per-participant visibility
  toggle, dispute action).
- `src/app/claims/page.tsx` (submit + list my claims), `src/app/claims/[id]/page.tsx`.
- `src/app/badges/[id]/page.tsx` (public badge detail: basis, issuer, date, status).
- `src/app/api/relationships/*` (create request, accept/decline, confirm, add evidence,
  set visibility, dispute), `src/app/api/claims/*`, `src/app/api/endorsements/*`,
  `src/app/api/feedback/*`.
- `src/lib/services/relationship-service.ts`, `claim-service.ts`, `badge-service.ts`,
  `endorsement-service.ts`, `feedback-service.ts` — this is where invariants #1–#5 in
  section 2 above get enforced.
- Hand-off component (for integration into the profile page):
  `src/components/relationships/profile-relationships-panel.tsx` — exports a server
  component `ProfileRelationshipsPanel({ profileUserId, viewerUserId })` rendering that
  user's visible relationships/endorsements/badges. Keep it self-contained (fetch its own
  data) so it can be dropped into `/p/[slug]/page.tsx` without prop-drilling from Vertical A.

### Vertical C — Discovery, help requests & opportunities (plan section 4.D, 4.E services)
Owns:
- `src/app/discover/page.tsx` — search people by skill/profession/location
  scope(local/region/global)/availability/stage, with a visible, explainable ranking
  (skill relevance, geography, availability, portfolio evidence) — no opaque single score.
- `src/app/help-requests/page.tsx`, `.../new/page.tsx`, `.../[id]/page.tsx`.
- `src/app/opportunities/page.tsx`, `.../new/page.tsx`, `.../[id]/page.tsx` (+ apply flow).
- `src/app/services/page.tsx`, `.../[id]/page.tsx` (public browse + inquiry), AND
  `src/app/settings/services/page.tsx` (+ editor) for a person/business managing their own
  `ServiceOffering`s — this vertical owns the whole `ServiceOffering`/`Inquiry` lifecycle.
- `src/app/api/search/*`, `src/app/api/help-requests/*`, `src/app/api/opportunities/*`,
  `src/app/api/services/*`, `src/app/api/inquiries/*`.
- `src/lib/services/search-service.ts`, `help-request-service.ts`, `opportunity-service.ts`,
  `service-offering-service.ts`. Use Postgres trigram/full-text (`pg_trgm`, add via a
  migration) or straightforward `ILIKE`/array-overlap queries for V1 — don't bring in an
  external search engine.

### Vertical D — Social feed & messaging (plan section 4.E messaging, 4.E feed)
Owns:
- `src/app/feed/page.tsx` + composer/post-card/comment components.
- `src/app/messages/page.tsx`, `.../[conversationId]/page.tsx`.
- `src/app/notifications/page.tsx`.
- `src/app/api/posts/*`, `src/app/api/comments/*`, `src/app/api/reactions/*`,
  `src/app/api/follows/*`, `src/app/api/conversations/*`, `src/app/api/messages/*`,
  `src/app/api/notifications/*`, `src/app/api/reports/*` (user-facing "Report" submission
  — creates a `Report` row; the admin review UI is Vertical E's job), `src/app/api/blocks/*`.
- `src/lib/services/post-service.ts`, `message-service.ts`, `notification-service.ts`,
  `follow-service.ts`, `report-service.ts`, `block-service.ts`.
- Hand-off: a small `<ReportButton targetType targetId />` client component at
  `src/components/safety/report-button.tsx` other verticals can drop onto any entity page.

### Vertical E — Admin dashboard & safety (plan section 4.F)
Owns everything under `src/app/admin/*` and `src/app/api/admin/*`:
- `src/app/admin/page.tsx` (overview/analytics: onboarding completion, profiles-with-
  primary-skill %, dispute rate, moderation turnaround — compute directly from Prisma
  aggregates, no external analytics tool for V1).
- `src/app/admin/skills/page.tsx` (approve/merge suggested skills & aliases).
- `src/app/admin/claims/page.tsx`, `.../claims/[id]/page.tsx` (verification review +
  `VerificationReview` audit history).
- `src/app/admin/disputes/page.tsx` (resolve `RelationshipDispute`s).
- `src/app/admin/reports/page.tsx` (moderation queue over `Report`).
- `src/app/admin/badges/page.tsx` (CRUD `BadgeDefinition`, manual `BadgeAward`/revoke).
- `src/app/admin/stage-rules/page.tsx` — document/configure the per-`SkillCategoryGroup`
  criteria used to assign `ProfessionalStage` (this can be a readable rules table + a
  "recompute stage" action for V1; a full automated rules engine is out of scope — note
  the simplification in your summary).
- `src/lib/services/admin-*.ts`. Query models directly via `prisma` rather than importing
  other verticals' service files (keeps you buildable in isolation); minor logic
  duplication here is an accepted tradeoff for parallel build safety.
- Use `requireAdmin()` from `src/lib/auth-helpers.ts` on every admin route/page. The
  `src/proxy.ts` route guard already redirects non-admins away from `/admin/*`, but
  server-side checks are the real enforcement — don't rely on the proxy alone.

## 5. Seed data

`prisma/seed.ts` (run via `pnpm db:seed`) creates fictional demo accounts spanning trades,
arts, agriculture, healthcare-adjacent non-clinical services, and technology, with
profiles, primary/secondary skills at different stages, portfolio items, a handful of
businesses, and a representative spread of relationship types/confirmation states
(including at least one self-declared-only `LEARNING_FROM`, one `MUTUALLY_CONFIRMED`
`WORKED_WITH`, and one disputed claim) so every vertical has real data to build against
immediately — run it before starting manual QA of any page.

## 6. Testing expectations

- Unit/integration (Vitest): service-layer tests for the invariants in section 2 above —
  at minimum, one test per vertical proving a self-declared relationship can't be
  auto-confirmed, and that visibility is per-participant.
  **Known limitation accepted for V1**: tests hit a real local Postgres (no mocking the
  database), matching how this stack is meant to run — use a separate test database or
  truncate between tests, documented in the vertical's own test setup.
- e2e (Playwright): cover the "Non-negotiable V1 test cases" in plan section 7 end to end
  once all verticals land (integration pass owns wiring this up fully; individual
  verticals may add page-level smoke tests for their own flows).
- Run `pnpm lint && pnpm typecheck` before considering any vertical done.

## 7. Deployment

Docker-ready: add a `Dockerfile` (multi-stage: pnpm install → `next build` → slim runtime
image) and document `docker compose up -d` (Postgres only locally; see note below) +
`pnpm db:deploy && pnpm db:seed` + `pnpm build && pnpm start` in `README.md` (integration
pass owns this, task 14).

## 8. Documented assumptions / deviations from the spec's suggestions

- **Prisma 7 → 6.19**: Prisma 7's `latest` npm tag is actually a release candidate
  (8.0.0-rc.x) that requires driver-adapter config (`prisma.config.ts` + `@prisma/adapter-pg`)
  instead of the classic `datasource { url = env(...) }` block. Pinned to Prisma 6.19.3
  (last stable major) for the simpler, better-documented config surface.
- **MinIO dropped from local Docker Compose**: Docker Hub (and quay.io) now gate MinIO's
  images behind authenticated pulls. Local dev uses a filesystem-backed storage driver
  (`STORAGE_DRIVER=local`, see `src/lib/storage/local.ts`) instead; the `s3` driver is
  fully implemented and is what production should set `STORAGE_DRIVER=s3` to use against
  any real S3-compatible bucket.
- **Uploads are proxied, not presigned**: `/api/uploads` accepts the file server-side and
  writes it via the storage driver, rather than issuing presigned client-direct-to-bucket
  URLs. Simpler single code path across both storage drivers; revisit presigned uploads if
  upload volume ever makes server-side proxying a bottleneck.
- **Account deletion is a soft delete**: scrubs email/name/password hash and sets
  `status = DELETED`, but keeps the `User`/`PersonProfile` rows so other users' relationship
  and claim records referencing this person stay referentially intact (plan invariant:
  no party can unilaterally erase another's shared-history record).
- **Professional stage assignment**: V1 ships the data model
  (`PersonSkill.stage`/`stageRationale`) and an admin-visible rules table, not a fully
  automated per-profession rules engine — Vertical E's `admin/stage-rules` page should make
  this limitation visible rather than imply more automation than exists, per plan section
  10's open decision on this exact point.
- **Search**: Postgres `ILIKE`/trigram, no dedicated search engine, per plan section 6's
  own "initially" guidance.

## 9. Build order (for this session)

Phase 0 foundation (done): scaffold, schema + migration, auth, storage/mail, design
tokens/UI primitives, this document. → Seed script → Verticals A–E in parallel → Integration
pass (wire hand-off components into shared pages, run lint/typecheck/tests, fix
cross-vertical issues) → README/deployment docs.
