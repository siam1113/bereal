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
- **Track 2 (identity & evidence, year 2 roadmap): `Reference`'s visibility is
  subject-controlled, not author-controlled.** A `Reference` only ever renders on the
  *subject's* profile (unlike `Relationship`, which renders on both parties' profiles
  and so needs one `RelationshipParticipantVisibility` row per side), so it carries a
  single `visibility` field gated to the subject (`setReferenceVisibility()` in
  `reference-service.ts`) rather than a per-participant table. Conservative/reversible
  choice made in the absence of an explicit spec answer; revisit if an author-side use
  case (e.g. "references I've written") ever needs its own visibility control.
- **Track 2: resolving a `RelationshipDispute`-shaped contest (`ReferenceDispute`,
  `ClaimAppeal`) never itself mutates the underlying `Reference`/`CredentialClaim`.**
  Mirrors the pre-existing `resolveDispute()` behavior for `RelationshipDispute` (which
  also only records the resolution, not a cascading status change). Revoking a
  reference or reversing a claim decision is a separate, explicit, independently
  audited action (`revokeReference()`, `decideClaim()`) — chosen so every status
  change always has its own direct audit event, never one implied by a dispute/appeal
  record alone. This is a conservative call in the absence of a specified workflow;
  revisit if admins want resolution and reversal combined into one action.
- **Track 2: `ClaimAppeal`/`ReferenceDispute` reuse the existing `DisputeStatus` enum**
  (`OPEN`/`UNDER_REVIEW`/`RESOLVED_UPHELD`/`RESOLVED_REMOVED`) rather than each
  defining their own — they're structurally the same "contest raised against a
  decision" shape as `RelationshipDispute`, and reusing it keeps the schema from
  accumulating near-duplicate enums.
- **Track 2: expiry is evaluated lazily on read, not by a background job.** No
  scheduler/cron infra exists in this app (confirmed against architecture.md before
  adding this). `CredentialClaim.expiresAt`/`BadgeAward.expiresAt`/`Reference.expiresAt`
  are nullable fields callers check at render time
  (`isClaimExpired()`/`isBadgeAwardExpired()`/`isReferenceExpired()`); `badge-service.ts`
  additionally exposes an explicit, admin-invoked `expireOverdueBadgeAwards()` sweep
  rather than a cron job that doesn't exist yet.

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
- **Track 2 (identity & evidence):** minimum reference count and anti-collusion
  criteria before a `Reference` contributes to a badge or stage signal — same open
  question already flagged above for feedback-derived badges, deliberately not
  resolved for references either. No code path currently lets a `Reference` feed a
  badge/stage decision automatically; it is evidence for a human to read, same as
  every other claim type.
- **Track 2:** which claim/reference types should qualify for automatic acceptance
  versus mandatory human review — V1 and this track both route every claim/reference
  through a human (admin review for claims; a confirmed-relationship gate plus
  dispute/appeal path for references), but nothing optimizes which ones *could* skip
  review.
- **Track 2:** appeal/dispute SLA and who specifically adjudicates (same admin queue
  as existing moderation, today — no separate appeals reviewer role was introduced).

## V1 launch constraints (from the original spec, still true)

Don't promise scale or revenue in V1. Launch dense in one or two geographic/skill
communities rather than thin everywhere — an empty-feeling network is worse than a
small dense one. Track onboarding completion, % of profiles with a primary skill and a
portfolio item, first relevant search success, relationship confirmation rate, dispute
rate, and moderation turnaround as the real health metrics, not raw signup count.
