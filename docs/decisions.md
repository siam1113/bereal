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
- **Three pre-existing `User` FKs don't cascade on delete:** `RelationshipDispute.raisedBy`,
  `RelationshipEvidence.addedBy`, `VerificationReview.reviewer` (their `relationship`/
  `claim` FKs do cascade; only the actor-pointing FK doesn't). Found while writing
  Track 9's test teardown — hard-deleting a user who raised a dispute, added
  evidence, or reviewed a claim fails with a foreign-key violation unless that row is
  deleted first. Account deletion is already a soft delete (see above), so this
  doesn't bite in the app today, but it will bite anything that ever hard-deletes a
  `User` row (admin tooling, GDPR erasure, test teardowns). Not fixed here — it
  predates this track and changing cascade behavior on shared models is outside this
  track's scope — but flagged so it isn't rediscovered the hard way.

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

## Policy questions from Track 9 (trust, safety & moderation at scale)

Flagged per `docs/roadmap/09-trust-safety-and-moderation.md`'s own "policy questions
to flag, not decide silently" — the mechanism exists so these can be set/changed
without a schema or code migration, but this track deliberately did not invent the
values themselves:

- **Abuse-pattern thresholds.** `abuse-detection-service.ts`'s only detector
  (`detectEndorsementRings`) flags a reciprocal endorsement pair with zero
  independent evidence — the most literal possible reading of the roadmap's
  "clusters of mutual confirmations with no independent evidence" example. It does
  not attempt: larger cycles (A→B→C→A), velocity-based patterns (endorsing many
  people in a short window), or any numeric threshold tuning. `ModerationFlag.severity`
  defaults to `MEDIUM` for every flag this track raises — there's no severity
  rubric. All of this is a product/legal call, not a default to invent; the
  `patternType`/`entityType` fields on `ModerationFlag` are free text specifically so
  new detectors and thresholds can be added without a migration once that call is
  made.
- **Dispute adjudication ownership and appeal path at scale.** `ReviewCase` gives
  disputes/claims/flags SLA, tier, and single-assignee tracking, but nothing in this
  build defines: who adjudicates when reviewers disagree, what an appeal beyond the
  current admin-dispute-queue looks like, or how caseload gets distributed across
  more than one admin as volume grows (`assignReviewCase` supports exactly one
  assignee; there's no team/role routing). This directly affects the "false
  verification rate" metric too — see `safety-metrics-service.ts`, which returns
  `null` for that metric today because the real signal (an approved claim later
  overturned on appeal) depends on Track 2's `ClaimAppeal`, which hasn't merged into
  this schema yet, *and* on deciding who has standing to grant such an appeal.
- **What counts as a "privacy incident."** `SafetyMetricEvent` can log a
  `PRIVACY_INCIDENT` metric type, but nothing in this build decides what qualifies
  or writes one — see `safety-metrics-service.ts#getSafetyMetricsSummary`.

## V1 launch constraints (from the original spec, still true)

Don't promise scale or revenue in V1. Launch dense in one or two geographic/skill
communities rather than thin everywhere — an empty-feeling network is worse than a
small dense one. Track onboarding completion, % of profiles with a primary skill and a
portfolio item, first relevant search success, relationship confirmation rate, dispute
rate, and moderation turnaround as the real health metrics, not raw signup count.
