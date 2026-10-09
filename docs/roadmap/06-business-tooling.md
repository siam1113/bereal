# Track 6 — Business tooling

## Scope

Deepen the existing Business entity: storefronts, workflow integrations, analytics,
verified memberships, and creator/trade-specific workflows called out in the Year 2
roadmap row.

## Why

Product-expansion "Businesses" track: "shops, agencies, cooperatives, professional
groups, teams, verified memberships, storefronts, workflow integrations, analytics."
Year 2 of the roadmap also separately names "creator/trade workflows."

## What exists today

`Business` model with owner/admin links and membership confirmation already exists
(see `prisma/schema.prisma`'s `Business` model and `../product-overview.md`'s "Account
and identity" section — "a claimed team membership needs the owner's confirmation to
show as confirmed rather than self-declared"). Services can already attach to a
business (Track 4's territory, shared model). Read `docs/data-model.md`'s entity-group
listing for exactly what's modeled today before adding fields.

## What to build

1. A storefront view: a public business page surfacing its services/portfolio/team in
   a structured, browsable layout — likely a UI/read-model concern more than new
   schema, check before adding models.
2. Verified memberships: membership confirmation already exists (self-declared →
   owner-confirmed) — "verified" here likely means layering Track 2's reference-check/
   claim-verification tier onto a membership claim, not a new parallel system.
3. Analytics: business-facing view counts, inquiry rates, etc. — needs an event/metrics
   approach; check whether anything exists yet (likely not) before designing storage.
4. Workflow integrations and creator/trade-specific workflows are intentionally vague
   in the source vision — this is a case to go back to the user for which specific
   workflow before building anything bespoke.

## Invariants to preserve

- Businesses stay secondary, linked identities to the people behind them — never a
  way to obscure who's actually doing the work (`../product-overview.md` principle 1).
- Membership confirmation keeps the same self-declared → owner-confirmed pattern as
  every other claim in this app, not a bespoke one-off.

## Policy questions to flag, not decide silently

- What "workflow integrations" and "creator/trade workflows" concretely mean — the
  source vision named them without specifics; get this from the user before building.
- Whether business analytics expose anything that could re-identify individual
  viewers (privacy risk if not careful).
