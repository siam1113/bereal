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
