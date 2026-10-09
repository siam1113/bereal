# Decisions and open questions

## Documented deviations from the original plan

Each of these was a deliberate call made during the build, not an oversight — recorded
here so nobody "fixes" them without knowing why they're this way.

- **Prisma 6.19, not 7.** Prisma 7's npm `latest` tag is actually a release candidate
  (8.0.0-rc.x) that requires driver-adapter config (`prisma.config.ts` +
  `@prisma/adapter-pg`) instead of the classic `datasource { url = env(...) }` block.
  6.19.3 (the last stable 6.x) keeps the simpler, better-documented config surface.
- **No MinIO in local Docker Compose.** Docker Hub (and quay.io) now gate MinIO's
  images behind authenticated pulls. Local dev uses the filesystem-backed `local`
  storage driver instead (see `src/lib/storage/local.ts`); `STORAGE_DRIVER=s3` is fully
  implemented for production against any real S3-compatible bucket.
- **Uploads are proxied, not presigned.** `/api/uploads` accepts the file server-side
  and writes it via the active storage driver, rather than issuing a presigned
  client-direct-to-bucket URL. One code path across both drivers; revisit if upload
  volume ever makes server-side proxying a bottleneck.
- **Account deletion is a soft delete.** Scrubs email/name/password hash and sets
  `status = DELETED`, but keeps the `User`/`PersonProfile` rows so other users'
  relationship/claim/feedback records referencing this person stay referentially
  intact — see [data-model.md](./data-model.md#soft-deleted-accounts).
- **Professional stage assignment is admin-manual, not a rules engine.** The data model
  (`PersonSkill.stage`/`stageRationale`) and an admin-visible criteria table exist; a
  fully automated per-profession rules engine does not. `/admin/stage-rules` says so
  in its own UI rather than implying more automation than exists.
- **Search is `ILIKE`/array-overlap, not trigram or a dedicated engine.** Matches the
  plan's own "initially" guidance; revisit if result quality or query latency demands it.
- **The admin dashboard uses Next.js server actions, not a separate `/api/admin/*`
  route tree.** Functionally equivalent to the rest of the app's REST-ish API routes,
  fewer files, and nothing outside the admin pages needs these over HTTP.
- **`cacheComponents`/`partialPrefetching` (Next 16's experimental PPR-style
  prerendering) were removed from `next.config.ts`.** They require every page touching
  `auth()`/`cookies()`/DB reads to explicitly opt in via Suspense or `"use cache"`.
  Nearly every route in this app is session- or DB-dependent by design, so standard
  per-request dynamic rendering is the right model here, not static prerendering with
  carved-out dynamic holes. (Confirmed by actually trying a production build with them
  enabled — it failed on most routes.)
- **`middleware.ts` → `proxy.ts`.** Next.js 16 renamed the file convention; functionally
  identical, same `auth()`-wrapped route-guard pattern.
- **`Post.visibility: CONNECTIONS` is treated as "any signed-in viewer."** The social
  feature area was built independently of the relationships one; rather than import an
  in-progress relationship-graph service mid-build, it approximates "connections" as
  "signed in" for V1. Revisit once/if a real social-graph-based feed filter is wanted.
- **No UI yet for `PersonProfile.contactPreference`.** The schema field exists; nothing
  currently reads or writes it from the UI.
- **Test coverage is deliberately partial.** One integration-test file covers the
  single most safety-critical invariant (relationship confirmation) end to end. The
  other four feature areas, and the full list of
  [non-negotiable V1 test cases](./product-overview.md#non-negotiable-v1-test-cases),
  are not yet covered by automated tests — see [testing.md](./testing.md).
- **The Docker deployment path is unverified.** Pattern-correct (standard Next.js
  standalone + Prisma setup) but no actual `docker build` was run against it — see
  [deployment.md](./deployment.md).
- **Track 5 (Learning & mentorship): `ExpertSession` scheduling is fully decoupled from
  `PersonProfile.availability`.** The track doc explicitly flagged "whether/how
  expert-session availability interacts with the existing `availability` field... or
  needs its own" as a policy question, not something to decide silently. The
  conservative, reversible choice taken here: `ExpertSession` carries its own
  `startsAt`/`endsAt` per session and never reads or writes `PersonProfile.availability`
  (a coarse status enum — `OPEN_TO_WORK`/`OPEN_TO_COLLAB`/`LIMITED`/`NOT_AVAILABLE` — not
  a calendar). This avoids overloading that field's existing meaning and keeps both
  schemas free to diverge; revisit if product wants a host's availability status to
  gate or auto-suggest session creation. Flagged for a human product decision, not
  resolved here.
- **Track 5: learning circles are a self-contained membership model, not a reuse of
  Track 3's private-network scoping.** The track doc suggested learning circles "could
  reuse Track 3's private-network scoping once that exists" — Track 3 (Relationships &
  collaboration graph) was being built concurrently in a separate worktree and its
  private-network tables don't exist in this codebase. `LearningCircle`/
  `LearningCircleMembership` were built as their own small-group construct (organizer
  role, capacity-gated join-approval flow) instead of guessing at Track 3's eventual
  shape. Flagged for reconciliation during integration — once Track 3's private-network
  model lands, someone should decide whether learning circles should be rebuilt on top
  of it or stay their own thing.
- **Track 5: accepting a `MentoringRequest` creates a real `MENTOR_MENTEE` `Relationship`
  by routing through the existing `relationship-service.ts` request-accept flow**
  (`respondToRelationshipRequest`), rather than inventing a parallel "connected" concept.
  The mentee's request becomes the relationship's `declaredByUserId`; the mentor
  accepting the request is explicitly not the same act as the mentor later calling
  `confirmRelationship()` — same SELF_DECLARED-until-countersigned distinction every
  other relationship in the app already has to respect.
- **Track 5: `mentoring-service.ts`/`expert-session-service.ts`/
  `learning-circle-service.ts` define their own `*AuthError` classes instead of
  importing `ForbiddenError` from `src/lib/auth-helpers.ts`.** `auth-helpers.ts` imports
  `src/lib/auth.ts`, which imports `next-auth`; that import chain doesn't resolve under
  the plain-node Vitest environment this project's service-layer tests run in (same
  reason `relationship-service.ts` already defines its own `RelationshipAuthError`/
  `RelationshipStateError` rather than reusing `ForbiddenError`). Route handlers still
  map these to 403s, so the HTTP contract is unchanged — this is purely about keeping the
  service layer unit-testable without a running Next.js/Auth.js context. Worth fixing at
  the `auth-helpers.ts` level eventually (e.g. splitting the error classes out of the
  module that imports `next-auth`) so future services don't have to route around it.

## Open questions before a public launch

Carried over from the original product spec — none of these are resolved by the V1
build, and shouldn't be assumed settled just because the app works:

- Exact stage criteria for each skill family, and review/appeal governance for them.
- Which claim types qualify for human review, and how to avoid exposing submitted
  documents/evidence more broadly than intended.
- Dispute and public-name-reference rules across different jurisdictions.
- Minimum feedback count and anti-collusion criteria before a feedback-derived badge
  can be awarded (the `BadgeDefinition.criteria` JSON field exists to hold this once
  decided; V1 ships two seed badge definitions as examples, not a settled policy).
- Whether the first real launch community should be local trades, creators, or a mixed
  set of professions — this affects seed-data strategy and initial moderation load far
  more than it affects the code.
- Brand clearance: "COMMON" is a provisional working name; trademark and domain
  availability were never checked.

## V1 launch constraints (from the original spec, still true)

Don't promise scale or revenue in V1. Launch dense in one or two geographic/skill
communities rather than thin everywhere — an empty-feeling network is worse than a
small dense one. Track onboarding completion, % of profiles with a primary skill and a
portfolio item, first relevant search success, relationship confirmation rate, dispute
rate, and moderation turnaround as the real health metrics, not raw signup count.
