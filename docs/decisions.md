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

- **Track 8 (AI assistance): external LLM calls are gated behind `AI_EXTERNAL_PROVIDER_
  ENABLED`, defaulted off, with a local/deterministic fallback for every feature.**
  Three policy questions from [roadmap/08-ai-assistance.md](./roadmap/08-ai-assistance.md)
  were flagged, not decided unilaterally, and still need explicit product/legal sign-off
  before the flag is ever turned on in production: (1) whether user content (bios,
  portfolio text, messages, search queries) may be sent to a third-party API at all;
  (2) which model/provider to standardize on — this build wires Anthropic's Messages API
  directly in `src/lib/ai-provider.ts` as the one concrete option to make the feature
  demonstrable, not as a chosen vendor; (3) what data-retention terms apply to anything
  sent externally. `src/lib/ai-provider.ts` is the single place the enable/disable gate
  lives; every `src/lib/services/ai-*.ts` service has a working non-network
  implementation (keyword/DB-lookup parsing, template-based drafts, an honest
  "translation unavailable" response) so the features are demonstrable with the flag
  off, and never silently skip or fail just because the policy question is still open.
  When the external path is used, only the minimum necessary text is sent (e.g. the
  search query itself, or the specific bio/portfolio notes a user asked to draft from)
  and any model-proposed skill name is always re-resolved against the real `Skill`
  table before use — it can never surface a hallucinated skill as real.
- **Track 8's NL-parsing, explanation, drafting, and translation features are built
  against Track 1's *current*, unranked `search-service.ts`** (`query`/`skillId`/
  `geoScope`/`availability`/`stage` params; `matchReasons` = `{skillMatch, geoMatch,
  hasPortfolio, availability}`), not the ranked search with a richer `matchReasons`
  breakdown the roadmap doc says this track should sit on top of — that hasn't landed
  in this worktree. `ai-query-parser-service.ts` and `ai-explain-service.ts` both carry
  "CROSS-TRACK GAP" comments at the point this matters. Once Track 1 ships ranked
  search, `explainMatch` in particular should be revisited to cite whatever additional
  relevance signals it adds — still never inventing anything beyond what `matchReasons`
  actually contains.
- **AI-generated moderation signals live in their own `AiModerationFlag` table, not in
  `Report`.** Mixing system-generated fraud-detection flags into the human-filed
  `Report` queue would blur exactly the distinction this track's invariants require
  ("AI output must always be visibly distinguishable from verified facts"). The
  `/admin/ai-flags` queue is reviewed the same way as Reports/Disputes (admin decides,
  nothing auto-actions), but is visually and structurally separate.

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
- AI assistance (Track 8): whether user content may be sent to a third-party LLM
  provider at all, which provider/model to standardize on, and what data-retention
  terms apply — `AI_EXTERNAL_PROVIDER_ENABLED` defaults to off specifically because none
  of this has been decided; see the Track 8 entry above and
  [roadmap/08-ai-assistance.md](./roadmap/08-ai-assistance.md).

## V1 launch constraints (from the original spec, still true)

Don't promise scale or revenue in V1. Launch dense in one or two geographic/skill
communities rather than thin everywhere — an empty-feeling network is worse than a
small dense one. Track onboarding completion, % of profiles with a primary skill and a
portfolio item, first relevant search success, relationship confirmation rate, dispute
rate, and moderation turnaround as the real health metrics, not raw signup count.
