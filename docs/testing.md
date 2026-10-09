# Testing

## Approach

`pnpm test` runs Vitest against your **real local Postgres** (the same `DATABASE_URL`
`pnpm dev` uses) — there's no mocking the database. Tests create their own throwaway
users/skills with a unique run-scoped suffix and delete them in `afterAll`; they don't
touch or depend on seed data.

This means: run `docker compose up -d` before `pnpm test`, same as for dev. If a test
run is interrupted mid-way before cleanup runs, you may get orphaned rows (unique emails
containing `@test.invalid` / skill slugs starting with `test-skill-`) — safe to delete
manually, or just `prisma migrate reset` if it's bothering you.

## What's covered today

`src/lib/services/__tests__/relationship-service.test.ts` exercises the single most
load-bearing invariant in the product (see
[data-model.md](./data-model.md#invariants-the-service-layer-enforces)):

1. Accepting a `RelationshipRequest` creates a `SELF_DECLARED` relationship.
2. The declaring party cannot confirm their own declaration (`confirmRelationship`
   throws `RelationshipAuthError`).
3. The counterpart confirming flips `confirmationStatus` to `MUTUALLY_CONFIRMED`.
4. Changing visibility only touches the acting participant's own
   `RelationshipParticipantVisibility` row.
5. An endorsement is `UNVERIFIED` against a self-declared relationship and `VERIFIED`
   once that relationship is mutually confirmed.

These were also manually verified end-to-end through real HTTP calls (login via
Auth.js's credentials callback, then exercising `/api/relationships/[id]/confirm` and
`/api/relationships/[id]/visibility` with real session cookies) during the integration
pass — not just at the service-function level.

`src/lib/services/__tests__/reference-service.test.ts` (Track 2 — identity &
evidence, year 2 roadmap) exercises:

1. `createReference()` refuses a reference against a `SELF_DECLARED` relationship and
   succeeds once it's `MUTUALLY_CONFIRMED` — the stronger gate than
   endorsements/feedback.
2. Only someone actually party to the relationship can author a reference about the
   other party.
3. Only the subject can change a reference's visibility or dispute it.
4. Disputing flips `Reference.status` to `DISPUTED` and opens a `ReferenceDispute`; a
   `REVOKED` reference can't be disputed again.
5. `isReferenceExpired()`'s lazy expiry check.

`src/lib/services/__tests__/claim-appeal-service.test.ts` (same track) exercises:

1. A claim can't be appealed until it's actually been decided (`REJECTED`/`REVOKED`).
2. Only the claim's own subject can appeal it.
3. A claim can't have two open appeals at once.
4. Resolving an appeal records the outcome but never mutates `CredentialClaim.status`
   by itself — reversing a decision still requires the explicit `decideClaim()` path.

Four more suites cover the Track 3 relationship-graph extensions (see
[decisions.md](./decisions.md#track-3--relationships--collaboration-graph-year-2-roadmap)),
each proving the same shape of invariant against the new constructs:

- `team-history-service.test.ts` — anchoring a relationship to a project requires being
  a party AND the project belonging to one of the parties; visible team history narrows
  (never widens) per each party's own `RelationshipParticipantVisibility`.
- `business-relationship-service.test.ts` — "acting for a side" means being that
  person, or a business's owner/confirmed admin; the declaring party can never confirm
  their own declaration; visibility only ever updates the acting side's own row.
- `mentoring-service.test.ts` — only the prospective mentor/mentee can propose; the
  proposer can't accept/decline their own proposal; accepting a program never silently
  creates a `Relationship` row.
- `private-network-service.test.ts` — linking a relationship into a network requires
  being both a party to it and an active network member; network scoping only narrows
  visibility, never overrides a participant's own hide.

`src/lib/services/__tests__/business-service.test.ts` (added during Track 6, business
tooling) covers the verified-membership tier layered on top of owner-confirmed
`BusinessMembership` (gating on `CONFIRMED` status, filing a `CredentialClaim`, status
flipping live once an admin approves it via the existing claims pipeline) and the
aggregate-only business analytics (owner-only access, self/member view exclusion,
inquiry counts sourced from the existing `Inquiry` table).

`src/lib/services/__tests__/search-service.test.ts` covers the Track 1 (search &
discovery, `docs/roadmap/01-search-and-discovery.md`) invariants: secondary skills are
fully searchable (not just primary), the `matchReasons` breakdown stays explainable
instead of collapsing into a blended score, trigram similarity actually gives
typo-tolerant matching, pagination (`limit`/`offset`/`total`/`hasMore`) is real, the two
flagged policy decisions hold (unapproved skills never surface via text match,
`PortfolioItem.visibility` gates the portfolio evidence signal — see
[decisions.md](./decisions.md)), and no precise-location field ever leaks onto a result.
One fixture note for anyone adding cases here: don't include the test file's run-scoped
`RUN_ID` suffix inside a *query string* used in an assertion — every fixture's
name/bio/skill-name in the file carries that same suffix, so a query containing it will
trigram-match unrelated fixtures purely on the shared substring, independent of the
thing you're actually trying to test.

`src/lib/services/__tests__/trust-safety.test.ts` covers Track 9's queue/workflow
primitives (see
[docs/roadmap/09-trust-safety-and-moderation.md](./roadmap/09-trust-safety-and-moderation.md)):
opening/closing a `ReviewCase` on a relationship dispute and on a tiered verification
claim, `openReviewCase`'s per-entity idempotency, `ModerationFlag` triage (escalate vs.
dismiss), and the endorsement-ring detector (flags a reciprocal evidence-less pair,
is idempotent across scans, and does not flag a pair with independent evidence). Its
`afterAll` is more involved than the relationship-service test's: `ReviewCase` /
`ModerationFlag` / `SafetyMetricEvent` point at the substantive record they're about
via a free-text `(entityType, entityId)` pair rather than a Prisma relation, so
`User` deletion doesn't cascade-clean them — every row gets its id pushed into a
tracking array for explicit pre-deletion. It also deletes `RelationshipDispute`,
`RelationshipEvidence`, and `VerificationReview` rows by actor id before deleting
users — those models' `relationship`/`claim` FK cascades, but their
`raisedBy`/`addedBy`/`reviewer` FKs to `User` do not (pre-existing gap, not
introduced by this track; see `docs/decisions.md`).

## Known gaps

Be upfront about these rather than implying more coverage than exists:

- Ten test files exist (the original V1 relationships suite, Track 2's reference and
  claim-appeal suites, the four Track 3 suites, Track 6's business-service suite,
  Track 1's search-service suite, and Track 9's trust-safety suite). The plan called
  for "at minimum, one test per feature area" — Social still doesn't have its own
  general test suite (Identity has partial coverage via Track 6's business-tooling
  tests; Discovery via Track 1's search-service tests; Admin via Track 9's
  trust-safety tests).
- `playwright.config.ts` has not been created. None of the
  [non-negotiable V1 test cases](./product-overview.md#non-negotiable-v1-test-cases)
  are covered by automated e2e tests yet — they were checked manually (curl + direct DB
  queries) during the build, not captured as a repeatable suite.
- No CI pipeline runs any of this automatically on push/PR.

## Adding a test

Follow the pattern in the existing test file: create your own users/entities with a
unique suffix, run assertions against the real service functions (not mocks), clean up
in `afterAll` in dependency order (delete rows that reference other rows first, or rely
on `onDelete: Cascade` by deleting the parent `User` row — check
`prisma/schema.prisma` for which relations cascade).

```bash
pnpm test           # run once
pnpm test:watch      # watch mode
```
