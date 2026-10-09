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

`src/lib/services/__tests__/ai-assistance.test.ts` covers Track 8 (AI assistance, see
[roadmap/08-ai-assistance.md](./roadmap/08-ai-assistance.md)) with
`AI_EXTERNAL_PROVIDER_ENABLED` unset, i.e. the default/off posture:

1. NL query parsing maps urgency/locality phrases and a real skill name to structured
   search params via the local heuristic, and never fabricates a skill match for text
   that names no real skill.
2. Match explanations only ever cite fields actually present on the search result
   (skill/geo match, portfolio count, availability) — nothing invented.
3. Portfolio/bio drafting returns the local-template fallback built only from the
   given title/tags/notes/skills.
4. Translation honestly reports "unavailable" and preserves the original text rather
   than fabricating a translation.
5. Fraud-signal scanning (rapid claim bursts, endorsement rings, repeated disputed
   self-declarations) creates `PENDING` `AiModerationFlag` rows traceable to the real
   claim/endorsement/relationship ids, never mutates the scanned records, and never
   double-flags the same target+reason on a repeat scan.
6. Admin resolution of a flag (`resolveAiFlag`) is a distinct, audited action — a flag
   stays `PENDING` until an admin acts on it.

These don't exercise the external-LLM-enabled code path (that would need a live
`ANTHROPIC_API_KEY` and defeats the point of a repeatable test suite) — only the local
fallback every feature has regardless of the flag.

## Known gaps

Be upfront about these rather than implying more coverage than exists:

- Only two test files exist. The plan called for "at minimum, one test per feature area"
  — Identity, Discovery, Social, and Admin don't have their own test suites yet.
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
