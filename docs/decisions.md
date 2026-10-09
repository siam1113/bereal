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
- **(Track 7) The three auth lifecycle routes were the only route handlers in the app
  with business logic leaking into the route itself.** An audit of every `route.ts`
  (per the Track 7 roadmap doc's "audit which routes/server actions are thin wrappers"
  item) found `register`, `reset-password`, and `delete-account` doing Prisma calls and
  password/token logic directly instead of delegating to a service. Extracted into
  `src/lib/services/auth-service.ts`; every other API route was already a thin wrapper.
  (The admin dashboard's server actions still call Prisma directly by design — see the
  dedicated bullet above; that was an already-settled exception, not something this
  audit reopened.)
- **(Track 7) `next-intl` is a recorded library decision, not a wired integration.**
  Added to `package.json` as the chosen library for future full UI-string translation.
  Deliberately not wired into any route/layout/component yet — see
  [localization.md](./localization.md). The thing actually wired end-to-end this track
  is `LocalizedLabel` (a DB table for enum-backed display labels), demonstrated in
  `src/app/p/[slug]/page.tsx`. Don't treat the unused `next-intl` dependency as dead
  code to remove; it's a placeholder for work explicitly out of this track's scope
  ("plumbing only," per the roadmap doc).

## Policy questions flagged, not decided (Track 7 — Platform, API & native clients)

The Track 7 roadmap doc calls these out explicitly as "policy questions to flag, not
decide silently" — real decisions that need a human, not a default an agent should pick
alone. Both are **flagged here, still open**; what follows is the conservative default
implemented while they're pending, not a resolution:

- **Auth model for non-browser clients.** Implemented: scoped API keys
  (`ApiKey` model + `src/lib/services/api-key-service.ts`), each tied to exactly one
  `User`, carrying an explicit narrow `scopes` list chosen at creation time, minted only
  from an authenticated web session, default 90-day expiry, user-revocable. This was
  chosen specifically because it's the most conservative of the options the roadmap doc
  named (API keys vs. OAuth client credentials vs. mobile app attestation) — it can
  never grant more than the issuing user's own session already could, and there's no new
  credential-issuing surface. **This default still needs explicit human sign-off before
  being treated as the final answer** — in particular, whether OAuth client credentials
  will eventually be needed for genuine third-party (not same-user-owned) partner
  integrations is unaddressed by this design, which assumes the caller and the resource
  owner are always the same person.
- **Whether/which partner integrations are even planned.** Not decided here, and
  deliberately not built around: `/api/v1/*` exists because the original build
  instruction required business logic to sit behind typed service interfaces for *any*
  future consumer (native app, integration, search engine), not because a specific
  partner integration is scheduled. No partner-specific auth flow, rate-limit tier, or
  data-sharing agreement exists. Building more than the generic versioned surface
  without a named consumer risks the roadmap's own "feature sprawl" risk-register entry
  — deliberately stopped at a generic API-key auth model plus the existing service
  surface, nothing partner-specific.

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
