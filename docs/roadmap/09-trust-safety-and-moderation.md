# Track 9 — Trust, safety & moderation at scale

## Scope

Scale the existing moderation/dispute/report tooling: abuse and rate-control systems, a
proper dispute-resolution workflow, tiered verification review, and the fairness/
false-verification-rate tracking named as supporting metrics. This is the track every
other track leans on once volume grows.

## Why

Named across Year 2–4 of the roadmap ("scalable moderation," "abuse prevention,"
"dispute resolution time," "false verification rate" as a named supporting metric) and
the risk register (fake claims/endorsement rings, harassment/doxxing, verification
costs growing too fast).

## What exists today

V1 already has report/block, a moderation queue, dispute handling, an audit log, and
rate limiting (`../product-overview.md`'s "Safety, accessibility, operations" section)
— read `docs/architecture.md` and the admin-dashboard code (Vertical E in git history)
for what's there before extending it.

## What to build

1. Rate-control/abuse-pattern detection beyond basic rate limiting — e.g. endorsement-
   ring detection (clusters of mutual confirmations with no independent evidence),
   surfaced to the moderation queue, not auto-actioned.
2. A structured dispute-resolution workflow with SLAs and status tracking, feeding the
   "dispute resolution time" metric named in the roadmap.
3. Tiered verification review queues (quick-path vs. deep-review) so verification cost
   doesn't scale linearly with claim volume — ties directly to the risk register's
   "verification costs grow too fast" entry.
4. Instrumentation for the roadmap's named safety metrics: complaint rate, dispute
   resolution time, false verification rate, privacy incidents — likely needs an
   events/metrics pipeline if one doesn't exist yet.

## Invariants to preserve

- Nothing here auto-actions against a user — flags and queues for human review, same
  pattern as the existing moderation queue.
- Audit trail stays intact and extends to any new abuse-detection action, same as
  existing claim/dispute audit history.

## Policy questions to flag, not decide silently

- Thresholds for what counts as an "abuse pattern" worth flagging — a product/legal
  decision, not a default to invent.
- Who adjudicates disputes and what the appeal path looks like once this scales beyond
  a single admin reviewing a queue.

## Dependencies

Every other track (Identity & evidence, Relationships, Opportunity network, AI
assistance's fraud-flagging) feeds into this track's queues — land this track's queue/
workflow primitives early if multiple tracks are running concurrently.
