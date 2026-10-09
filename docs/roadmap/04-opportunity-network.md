# Track 4 — Opportunity network

## Scope

Extend V1's existing help-requests/opportunities/services layer toward microtasks,
apprenticeships, team formation, and project sourcing. Explicitly **not** building
payments/escrow or transaction infrastructure in this track — that stays gated behind a
separate legal/compliance readiness check.

## Why

Product-expansion "Opportunity network" track, named in the Year 2–3 roadmap rows.

## What exists today

V1 already has help requests (with responses/shortlisting), opportunities (tasks/
contract/full-time with apply/status flows), and services (attached to a person or
business, with an inquiry flow, no payments) — see `../product-overview.md`'s "Social
and opportunity layer" and `docs/architecture.md` for where this lives in the service
layer. Read those before extending the model.

## What to build

1. A microtask/gig structure distinct from the existing "opportunity" shape if the
   existing model can't cleanly represent short, bounded, possibly-recurring tasks —
   check first whether extending `Opportunity` with a `kind` discriminator is simpler
   than a new model.
2. Apprenticeship as an opportunity kind with a structured duration/mentorship link —
   likely references Track 5's mentoring construct once that exists; coordinate if
   built concurrently.
3. Team formation / project sourcing: a way to post "need N people with skills X, Y for
   project Z" and assemble a team from applicants, distinct from a single-hire
   opportunity.

## Invariants to preserve

- No payments, escrow, or transaction handling — stays explicitly out of scope until
  the roadmap's own stage gate (legal/compliance review) is satisfied.
- A client can still post, see matches, inquire, and message — don't regress the
  existing non-negotiable test case while extending the model.

## Policy questions to flag, not decide silently

- Any monetization attached to opportunity visibility (sponsored placement) risks the
  named risk-register entry "monetization damages trust" — flag before implementing
  any paid-boost mechanic here.
