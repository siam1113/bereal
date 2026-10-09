# Track 2 — Identity & evidence

## Scope

Move from "self-claim + admin-reviewed claim" (V1's two tiers) toward a third tier:
**reference checks** — a structured reference left by someone with a *confirmed*
relationship to the subject, distinct from an endorsement. Also: claim provenance/audit
trail hardening, expiry, and an appeals path. Don't build a general "trust score" — that
is explicitly ruled out.

## Why

"Identity and proof" product-expansion track: standardized claim schemas, review
provenance, verifiable attestations where useful, skills evidence portability,
expiry/revocation, appeal mechanisms. Year 2 of the roadmap names "reference checks"
specifically.

## What exists today

- Claim types already modeled: identity, experience, credential, project/work,
  competency — self-submitted, admin-reviewed, full audit history (see
  `docs/data-model.md` and `../product-overview.md`'s "Professional stages and
  evidence" section). Badge model exists for claim verification, feedback-derived
  attributes, and achievements (`BadgeDefinition.criteria` is schema-only — two seed
  examples, not a settled policy, per `docs/decisions.md`).
- Endorsements already require a declared relationship first (`../product-overview.md`
  principle 10) — reference checks are a *new*, stronger tier above this, not a
  replacement.
- Professional stage assignment is currently **admin-manual**, not a rules engine
  (`docs/decisions.md`) — `/admin/stage-rules` says so in its own UI. A reference-check
  system should feed evidence *into* that manual process, not quietly automate stage
  assignment as a side effect.

## What to build

1. A `Reference` (or similarly named) model: author, subject, the specific confirmed
   relationship it's anchored to, structured content (not freeform-only — e.g. scoped
   attributes similar to the existing feedback-attribute pattern), status
   (submitted/disputed/revoked), visibility controls mirroring the existing claim/
   relationship visibility pattern.
2. Expiry and revocation fields/flows on claims generally, not just references — check
   whether `Claim`/`Badge` models already have room for this before adding new columns.
3. An appeals path: a disputed or rejected claim/reference needs a way for the subject
   to contest it, visible to admin review queues alongside existing moderation/dispute
   tooling.

## Invariants to preserve

- A reference still requires the author to have a *confirmed* (not merely self-
  declared) relationship with the subject — same gate as existing endorsements, just a
  stronger evidence tier.
- Unconfirmed anything stays visibly unverified; a reference never silently upgrades
  stage or mints a verified badge on its own.
- Full audit history on every reference, same as existing claims.

## Policy questions to flag, not decide silently

- Minimum reference count and anti-collusion criteria before a reference contributes to
  a badge or stage signal — `docs/decisions.md` already flags this exact open question
  for feedback-derived badges; don't resolve it unilaterally here either.
- Which claim/reference types qualify for human review vs. automatic acceptance.
- Appeal SLA and who adjudicates disputes.

## Out of scope here

Any automated stage-assignment rules engine (explicitly still manual by design per
`docs/decisions.md`) and any numeric trust/reputation score.
