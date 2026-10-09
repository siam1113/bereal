# Track 5 — Learning & mentorship

## Scope

A mentorship marketplace (discoverable, structured mentoring offers — distinct from the
existing one-sided "learning-from" self-declaration), expert sessions (bookable,
time-boxed), and learning circles (small group, not just one-to-one). Reinforce
pathway visibility: Learning → Emerging → Practicing, without implying paid work is
inherently more worthy.

## Why

Product-expansion "Learning" track: "mentorship marketplaces, expert sessions, learning
circles, practical portfolios, pathways from Learning → Emerging → Practicing; do not
equate paid work with inherent worth."

## What exists today

The one-sided "learning-from" relationship type and declaration already exist and are
explicitly never implying the other party agreed (`../product-overview.md` principle 8;
non-negotiable test case). Professional stage (Learning/Emerging/Practicing/
Established) is schema-modeled and admin-assigned (`PersonSkill.stage`/
`stageRationale`) — see `docs/decisions.md` on why it's manual, not a rules engine.

## What to build

1. A mentoring-offer construct: a person declares availability to mentor, with scope
   (skill, format, capacity) — discoverable via search (Track 1). This is the mutual
   counterpart to the existing one-sided learning-from declaration; keep both — don't
   collapse one into the other.
2. Expert sessions: bookable, time-boxed sessions tied to a mentor/expert profile —
   likely needs a lightweight scheduling model; no payment processing in this track.
3. Learning circles: a small-group construct, possibly reusing Track 3's
   private-network scoping once that exists.

## Invariants to preserve

- The existing one-sided learning-from declaration stays exactly as-is (self-declared,
  author-hideable, never implying agreement) — this track adds a *mutual* option
  alongside it, not a replacement.
- Stage pathway (Learning → Emerging → Practicing → Established) framing stays
  evidence-based, not a ranking of worth; don't let a mentoring marketplace imply
  "established" mentors are inherently more valuable than "emerging" ones offering
  peer mentoring.

## Policy questions to flag, not decide silently

- Whether/how expert-session availability interacts with the existing `availability`
  field on `PersonProfile`, or needs its own.

## Dependencies

Builds on Track 3's relationship/private-network work if that lands first; can start
independently on the mentoring-offer and expert-session pieces regardless.
