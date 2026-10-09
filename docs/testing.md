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

- Two test files exist (relationship-service, trust-safety). The plan called for "at
  minimum, one test per feature area" — Identity, Discovery, Social, and Admin
  (outside what Track 9 added) don't have their own test suites yet.
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
