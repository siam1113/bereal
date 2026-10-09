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
- **Search is now Postgres full-text + trigram ranked, not plain `ILIKE`/array-overlap.**
  (Track 1, `docs/roadmap/01-search-and-discovery.md`.) A generated, stored `tsvector`
  column on `PersonProfile` (`displayName` weight A, `bio` weight B) plus `pg_trgm` GIN
  indexes on `PersonProfile.displayName`/`bio`, `Skill.name`, and `SkillAlias.alias` back
  a blended `ts_rank` + trigram-similarity order (typo-tolerant), replacing `updatedAt
  desc`. Deliberately stops short of a dedicated search engine (Meilisearch/Typesense/
  Elasticsearch) or semantic/embedding matching — revisit only if measured latency or
  result quality demands more, per the roadmap's own stage-gating. Two policy calls made
  as part of this track, flagged per the roadmap doc rather than decided silently:
  - **Unapproved/pending skills (`Skill.isApproved: false`) never surface a profile via
    skill-name/alias text matching**, in both `searchPeople` and `searchSkillsForPicker`
    — matches the pre-existing picker behavior. A profile can still surface through its
    own displayName/bio text; only the skill-identity channel is gated. This is a
    starting default, not a settled policy — revisit if there's a product reason
    unapproved skills should surface (ranked lower, say) rather than being invisible to
    search entirely.
  - **`PortfolioItem.visibility` now gates search's portfolio evidence signal** —
    `hasPortfolio`/`portfolioCount` count `PUBLIC` items only, matching what
    `getProfileBySlug()` actually renders on the profile page itself. Before this track,
    search counted all portfolio items regardless of visibility, which could show
    "has portfolio" evidence for private work a searcher couldn't actually see.
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

## Track 5 — Learning & mentorship (year-2+ roadmap)

- **`ExpertSession` scheduling is fully decoupled from `PersonProfile.availability`.**
  The track doc explicitly flagged "whether/how expert-session availability interacts
  with the existing `availability` field... or needs its own" as a policy question, not
  something to decide silently. The conservative, reversible choice taken here:
  `ExpertSession` carries its own `startsAt`/`endsAt` per session and never reads or
  writes `PersonProfile.availability` (a coarse status enum —
  `OPEN_TO_WORK`/`OPEN_TO_COLLAB`/`LIMITED`/`NOT_AVAILABLE` — not a calendar). This
  avoids overloading that field's existing meaning and keeps both schemas free to
  diverge; revisit if product wants a host's availability status to gate or
  auto-suggest session creation. Flagged for a human product decision, not resolved
  here.
- **Learning circles are a self-contained membership model, not a reuse of Track 3's
  private-network scoping.** The track doc suggested learning circles "could reuse
  Track 3's private-network scoping once that exists" — Track 3 (Relationships &
  collaboration graph) was being built concurrently in a separate worktree and its
  private-network tables weren't available at the time. `LearningCircle`/
  `LearningCircleMembership` were built as their own small-group construct (organizer
  role, capacity-gated join-approval flow) instead of guessing at Track 3's shape.
  **Now that Track 3 has landed** (see below), someone should decide whether learning
  circles should be rebuilt on top of `PrivateNetwork` or stay their own thing — not yet
  reconciled.
- **Accepting a `MentoringRequest` creates a real `MENTOR_MENTEE` `Relationship` by
  routing through the existing `relationship-service.ts` request-accept flow**
  (`respondToRelationshipRequest`), rather than inventing a parallel "connected" concept.
  The mentee's request becomes the relationship's `declaredByUserId`; the mentor
  accepting the request is explicitly not the same act as the mentor later calling
  `confirmRelationship()` — same SELF_DECLARED-until-countersigned distinction every
  other relationship in the app already has to respect.
- **`mentoring-service.ts`/`expert-session-service.ts`/`learning-circle-service.ts`
  define their own `*AuthError` classes instead of importing `ForbiddenError` from
  `src/lib/auth-helpers.ts`.** `auth-helpers.ts` imports `src/lib/auth.ts`, which imports
  `next-auth`; that import chain doesn't resolve under the plain-node Vitest environment
  this project's service-layer tests run in (same reason `relationship-service.ts`
  already defines its own `RelationshipAuthError`/`RelationshipStateError` rather than
  reusing `ForbiddenError`). Route handlers still map these to 403s, so the HTTP contract
  is unchanged — this is purely about keeping the service layer unit-testable without a
  running Next.js/Auth.js context. Worth fixing at the `auth-helpers.ts` level eventually
  (e.g. splitting the error classes out of the module that imports `next-auth`) so future
  services don't have to route around it.

**Note on naming**: Track 3 and Track 5 each independently built a file named
`mentoring-service.ts` for unrelated features — Track 3's is the mutual
`MentoringProgram` construct (propose/accept lifecycle, optionally cross-linked to a
confirmed `Relationship`); Track 5's is the `MentoringOffer`/`MentoringRequest`
marketplace (discoverable offers, requests that create a `Relationship` via the normal
request-accept flow). During integration these were merged side-by-side into one file
— see that file's top-of-file comment for the disambiguation. Consider renaming one of
the two underlying concepts (e.g. `MentoringProgram` → `MentoringEngagement`) if the
overlap in terminology proves confusing in practice.

## Track 3 — Relationships & collaboration graph (year-2+ roadmap)

Extends the V1 relationship graph with project/team-history anchoring, business-to-
person/business-to-business relationships, structured mentoring programs, and optional
private networks — see
[roadmap/03-relationships-and-collaboration.md](./roadmap/03-relationships-and-collaboration.md)
for the full scope. Flagged policy questions from that track doc, deliberately **not**
decided unilaterally — the choices below are the most conservative/reversible option,
implemented so the feature works, pending an actual product decision:

- **What counts as "sensitive" for the explicit-consent requirement beyond the existing
  `FAMILY` case — not decided.** None of this track's new relationship types
  (business engagement/endorsement/partnership, mentoring programs, private-network
  membership) got a new consent gate. They follow the existing default (self-declared →
  mutually-confirmed, per-side visibility) with no additional identity-disclosure gate
  the way `FAMILY` has `counterpartConsent`. If a future call decides e.g.
  `BUSINESS_ENGAGEMENT` or mentoring programs between a minor and an adult need a
  consent gate too, that's a new field/flow to add deliberately, not something this
  track inferred.
- **Default visibility of private-network membership itself — defaulted to
  members-only (`PrivateNetwork.membershipVisible = false`), not decided as final.**
  The track doc asks "is network membership visible outside the network?" without
  answering it. `membershipVisible` exists as a per-network toggle so a real answer can
  flip the default later without a schema change; `listNetworkMembers()` enforces
  whichever value is set. Chosen default is the more private, more reversible one
  (easy to later expose a membership list; much harder to walk back an already-public
  one).

Two scope simplifications made to keep this track's surface area contained (not policy
questions — these don't weaken any stated invariant, just narrow what got built):

- **`BusinessRelationship` creation is a single "declare" call, not a
  propose/accept handshake like `RelationshipRequest` → `Relationship`.** The one
  load-bearing trust invariant — the declaring party can never be the one who confirms
  — is fully preserved via `confirmBusinessRelationship()`. The two-step handshake in
  the person-to-person flow is a UX nicety on top of that invariant, not the invariant
  itself, so it wasn't duplicated for the business-relationship table.
- **Structured mentoring programs (`MentoringProgram`) never auto-create or
  auto-confirm a `Relationship` row.** A program's own `PROPOSED → ACTIVE` transition
  is a separate, self-contained lifecycle; blending it into `Relationship`'s
  confirmation state would create a second path to "mutually confirmed" alongside
  `confirmRelationship()`'s declare-then-counterpart-confirms flow. `relationshipId` is
  only an optional cross-link for when a confirmed `MENTOR_MENTEE` `Relationship`
  separately exists between the same two people.

Left out of scope for this pass (land core models/services first, per the track doc's
own instruction that Opportunity network and Learning & mentorship will build on these
later): no new UI pages for team history, business relationships, mentoring programs,
or private networks — API routes and service-layer functions only, following the
thin-route-over-service-layer pattern. No session-scheduling/marketplace UI for
mentoring (that's Track 5's scope). No `prisma/seed.ts` demo data for any of the four
new constructs.

## Policy questions flagged during Year 2+ build-out (not decided here)

Per each roadmap track doc's own "flag, not decide silently" instructions — these are
raised for a human decision, not resolved by any code in these tracks:

- **Track 4 (opportunity network) — sponsored/paid placement.** Any monetization
  attached to opportunity visibility (e.g. a paid-boost mechanic that ranks a listing
  above others) risks the risk register's named "monetization damages trust" entry.
  Nothing paid-placement-shaped was implemented in Track 4's microtask/apprenticeship/
  team-formation work — `listOpportunities`/`getOpportunity` in
  `src/lib/services/opportunity-service.ts` return results ordered the same way V1
  always did (no boost/priority field exists on `Opportunity`). Flagging before anyone
  builds a sponsored-placement feature here, per
  [04-opportunity-network.md](./roadmap/04-opportunity-network.md).
- **Verified business memberships (Track 6) are backed by a generic `CredentialClaim`,
  not Track 2's `Reference` model.** Track 2's `Reference`/`ReferenceDispute`
  model and `reference-service.ts` — described as "a confirmed-relationship-gated
  structured reference, a tier above endorsements" — is the better-fitting backing
  primitive for "verified membership," but it hadn't landed in this worktree when
  Track 6 was built. `BusinessMembership.verificationClaimId` reuses the existing
  claim/`VerificationReview` admin pipeline instead, as a third tier on top of the
  existing self-declared → owner-confirmed membership states. This is a deliberate,
  explicitly-flagged seam (see the comments on `verificationClaimId` in
  `prisma/schema.prisma` and the "Verified memberships" section of
  `src/lib/services/business-service.ts`), not a parallel system meant to stick
  around — once Track 2 lands, a human integrator should consider swapping this
  claim-based link for a Reference-based one (e.g. a membership verification backed
  by a Reference from another confirmed member/owner of the same business).
- **Business analytics (Track 6) are aggregate-only by design, with no per-viewer
  breakdown ever surfaced to the business owner** — a conservative, reversible
  default answer to the re-identification policy question below, not a settled
  policy decision. `viewerUserId` is retained on each `BusinessAnalyticsEvent` only
  for a possible future dedupe/fraud pass; no function in `business-service.ts`
  projects it back out per-row.
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

## Track 9 — Trust, safety & moderation at scale (year-2+ roadmap)

Builds generic review-case/flagging primitives (`ReviewCase`, `ModerationFlag`,
`SafetyMetricEvent`) against V1's existing moderation/claim/dispute models only — see
[roadmap/09-trust-safety-and-moderation.md](./roadmap/09-trust-safety-and-moderation.md).
Every pointer from these models to "the thing being reviewed" is a free-text
`(entityType, entityId)` pair (same convention `AuditEvent` already uses), never a
Prisma relation to a specific model — this is deliberate so Track 2's
`ReferenceDispute`/`ClaimAppeal` and Track 3's `BusinessRelationshipDispute` and
friends can plug in as new `entityType` values with no migration required. Integration
contract for whoever wires those tracks in: open one `ReviewCase` row per item needing
review, and call `recordSafetyMetricEvent()` alongside it.

Flagged policy questions from the track doc, not decided here:

- **Abuse-pattern thresholds** — only one concrete detector exists (reciprocal
  endorsements with no independent evidence); larger-cycle ring detection and the
  actual thresholds for flagging are not implemented. A product/legal call, not a
  default to invent.
- **Dispute-adjudication/appeal ownership at scale** — today everything routes through
  a single-assignee `ReviewCase` in the existing admin queue; no dedicated
  adjudication/appeals governance model exists beyond that.
- **What counts as a "privacy incident"** for the safety-metrics instrumentation named
  in the roadmap — not defined; `SafetyMetricEvent` can record one once a definition
  exists, but nothing currently classifies one.

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
- What "workflow integrations" and "creator/trade-specific workflows" concretely mean
  for the Businesses track (Track 6) — the source product vision named both without
  specifics. Deliberately not built or guessed at; needs a concrete answer from the
  user (which workflows, which third-party systems if any) before any bespoke
  integration work starts. See `docs/roadmap/06-business-tooling.md`.
- Whether business analytics should ever expose any per-viewer breakdown to a
  business owner, versus staying aggregate-only forever. The current build defaults
  to aggregate-only (see the deviation above) as the conservative, reversible
  starting point — not a final answer on the underlying privacy/re-identification
  question.

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
