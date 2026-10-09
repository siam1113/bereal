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

## Known gaps

Be upfront about these rather than implying more coverage than exists:

- Two test files exist (relationships, search/discovery). The plan called for "at
  minimum, one test per feature area" — Identity, Social, and Admin don't have their own
  test suites yet.
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
